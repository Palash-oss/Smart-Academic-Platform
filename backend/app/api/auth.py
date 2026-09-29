from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.db.session import get_db
from app.db.models import (
    User,
    Department,
    Division,
    CourseOffering,
    Course,
    ClassSection,
    PracticalBatch,
    StudentEnrollment,
    AttendanceLog,
)
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login-form")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """FastAPI Dependency: Decodes JWT token and returns current authenticated User object."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


def require_role(allowed_roles: list[str]):
    """FastAPI Dependency factory: restricts route access to specified user roles."""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden for user role '{current_user.role}'. Required: {allowed_roles}"
            )
        return current_user
    return role_checker


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new student or faculty member with automatic COMPS department, division & core course onboarding."""
    if user_in.role not in ["STUDENT", "FACULTY", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be one of: 'STUDENT', 'FACULTY', 'ADMIN'"
        )

    clean_email = user_in.email.strip().lower()

    # Check if user with email exists
    stmt = select(User).where(func.lower(User.email) == clean_email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Find primary COMPS department
    dept_res = await db.execute(select(Department).where(Department.code == "COMP"))
    dept_comp = dept_res.scalar_one_or_none()

    division_id = None
    div_name = "A"

    if user_in.role == "STUDENT" and dept_comp:
        # Determine division (Division A by default or Division B if A exceeds target)
        divs_res = await db.execute(
            select(Division).where(Division.department_id == dept_comp.id).order_by(Division.name)
        )
        divs = divs_res.scalars().all()
        if divs:
            div_a = next((d for d in divs if d.name == "A"), divs[0])
            div_b = next((d for d in divs if d.name == "B"), None)

            # Count students in A
            count_a_res = await db.execute(select(func.count(User.id)).where(User.division_id == div_a.id))
            count_a = count_a_res.scalar() or 0

            if div_b and count_a >= 70:
                chosen_div = div_b
                div_name = "B"
            else:
                chosen_div = div_a
                div_name = "A"

            division_id = chosen_div.id

    # Auto-generate Roll No & ERP ID if not provided
    roll_no = user_in.roll_no.strip() if user_in.roll_no else None
    erp_id = user_in.student_erp_id.strip() if user_in.student_erp_id else None

    if user_in.role == "STUDENT":
        if not roll_no:
            # Count total students in this division
            div_count_res = await db.execute(select(func.count(User.id)).where(User.division_id == division_id))
            next_idx = (div_count_res.scalar() or 0) + 1
            roll_no = f"COMP-{div_name}-{next_idx:02d}"
        if not erp_id:
            erp_id = f"COMP2024{div_name}{uuid.uuid4().hex[:4].upper()}"

    user = User(
        email=clean_email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        role=user_in.role,
        student_erp_id=erp_id,
        roll_no=roll_no,
        department_id=dept_comp.id if dept_comp else None,
        division_id=division_id,
    )
    db.add(user)
    await db.flush()

    # If STUDENT: Auto-enroll in the 5 Core Courses for Semester 5
    if user_in.role == "STUDENT" and dept_comp and division_id:
        try:
            # Extract numeric roll index for 4-batch assignment (B1: 1-18, B2: 19-36, B3: 37-53, B4: 54-70)
            roll_digits = "".join(filter(str.isdigit, roll_no or ""))
            roll_num = int(roll_digits) if roll_digits else 1
            if roll_num <= 18:
                batch_key = "B1"
            elif roll_num <= 36:
                batch_key = "B2"
            elif roll_num <= 53:
                batch_key = "B3"
            else:
                batch_key = "B4"

            # Fetch active offerings for 2026-27-SEM5 (CLASS tier = Core)
            core_off_stmt = (
                select(CourseOffering)
                .join(Course, CourseOffering.course_id == Course.id)
                .where(Course.course_tier == "CLASS", Course.department_id == dept_comp.id)
            )
            core_offs = (await db.execute(core_off_stmt)).scalars().all()

            for off in core_offs:
                # Find matching theory section (COMP-A-Theory or COMP-B-Theory)
                sec_stmt = select(ClassSection).where(
                    ClassSection.offering_id == off.id,
                    ClassSection.section_name == f"COMP-{div_name}-Theory"
                )
                sec = (await db.execute(sec_stmt)).scalar_one_or_none()

                # Find matching practical batch (COMP-A-B1 etc.)
                batch_stmt = select(PracticalBatch).where(
                    PracticalBatch.offering_id == off.id,
                    PracticalBatch.batch_name == f"COMP-{div_name}-{batch_key}"
                )
                batch = (await db.execute(batch_stmt)).scalar_one_or_none()

                enr = StudentEnrollment(
                    id=uuid.uuid4(),
                    student_id=user.id,
                    offering_id=off.id,
                    section_id=sec.id if sec else None,
                    batch_id=batch.id if batch else None,
                )
                db.add(enr)

                # Fetch course name for attendance log
                course = (await db.execute(select(Course).where(Course.id == off.course_id))).scalar_one()
                log = AttendanceLog(
                    id=uuid.uuid4(),
                    student_id=user.id,
                    course_id=course.id,
                    subject=f"{course.name} ({course.code})",
                    total_classes=28,
                    attended_classes=26,  # ~92.8% starter baseline
                )
                db.add(log)
        except Exception as enr_err:
            print(f"[Notice] Auto-enrollment error for new student {clean_email}: {enr_err}")

    await db.commit()
    await db.refresh(user)
    return user


LOGIN_EMAIL_ALIASES = {
    # Students (Manav, Shonit, Palash, Saad)
    "palash": "crce.10265.ceb@gmail.com",
    "palash@academic.edu": "crce.10265.ceb@gmail.com",
    "palash@student.academic.edu": "crce.10265.ceb@gmail.com",
    "shonit": "crce.10277.ceb@gmail.com",
    "shonit@academic.edu": "crce.10277.ceb@gmail.com",
    "shonit@student.academic.edu": "crce.10277.ceb@gmail.com",
    "manav": "crce.10279.ceb@gmail.com",
    "manav@academic.edu": "crce.10279.ceb@gmail.com",
    "manav@student.academic.edu": "crce.10279.ceb@gmail.com",
    "saad": "crce.10468.ceb@gmail.com",
    "saad@academic.edu": "crce.10468.ceb@gmail.com",
    "saad@student.academic.edu": "crce.10468.ceb@gmail.com",
    "student@academic.edu": "crce.10265.ceb@gmail.com",
    # Faculty (Sujata, Kalpana, Vijay, Smita)
    "faculty@academic.edu": "sujata.deshmukh@academic.edu",
    "sujata": "sujata.deshmukh@academic.edu",
    "sujata@academic.edu": "sujata.deshmukh@academic.edu",
    "kalpana": "kalpana.deorukhkar@academic.edu",
    "kalpana@academic.edu": "kalpana.deorukhkar@academic.edu",
    "vijay": "vijay.shelake@academic.edu",
    "vijay@academic.edu": "vijay.shelake@academic.edu",
    "smita": "smita.ambarkar@academic.edu",
    "smita@academic.edu": "smita.ambarkar@academic.edu",
}

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT access token."""
    clean_email = credentials.email.strip().lower()
    clean_password = credentials.password.strip()

    # Map aliases if provided
    resolved_email = LOGIN_EMAIL_ALIASES.get(clean_email, clean_email)

    stmt = select(User).where(func.lower(User.email) == resolved_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(clean_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        student_erp_id=user.student_erp_id,
        roll_no=user.roll_no,
    )


@router.post("/login-form", response_model=TokenResponse)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """OAuth2 compatible token login endpoint for Swagger UI."""
    return await login(UserLogin(email=form_data.username, password=form_data.password), db)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return current_user
