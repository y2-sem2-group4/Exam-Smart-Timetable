from .models import Exam, Enrolment, ExamStatus

def check_and_flag_exam_clashes(exam):
    """
    Evaluates a single exam for clashes against room capacity and other exams.
    Updates the exam status to PENDING_REVIEW or RESOLVED accordingly.
    """
    clash_detected = False
    reasons = []

    # 1. Venue Capacity Deficit
    if exam.room:
        # Count how many students are enrolled in the unit
        enrolled_count = Enrolment.objects.filter(unit=exam.unit).count()
        if enrolled_count > exam.room.capacity:
            clash_detected = True
            reasons.append(f"Room too small (Cap: {exam.room.capacity}, Enrolled: {enrolled_count})")

    # 2. Time Overlap Query 
    # Strictly less than (<) and greater than (>) ensures back-to-back exams do NOT clash.
    overlapping_exams = Exam.objects.filter(
        exam_date=exam.exam_date,
        start_time__lt=exam.end_time,
        end_time__gt=exam.start_time
    ).exclude(id=exam.id) # Can't check the exam against itself!

    # 3. Shared-Student Conflict Filtering
    # Get the IDs of all students taking THIS exam's unit
    students_in_this_unit = Enrolment.objects.filter(unit=exam.unit).values_list('student_id', flat=True)

    for other_exam in overlapping_exams:
        # Check if ANY of those students are also taking the OTHER exam's unit
        shared_student_exists = Enrolment.objects.filter(
            unit=other_exam.unit,
            student_id__in=students_in_this_unit
        ).exists()

        if shared_student_exists:
            clash_detected = True
            reasons.append(f"Student clash with {other_exam.unit.unit_code}")

    # 4. Automated System Status Flagging (FR-04)
    if clash_detected:
        exam.status = ExamStatus.PENDING_REVIEW
        exam.clash_reason = " | ".join(reasons)
    else:
        # If it was previously flagged but the admin fixed it, mark it resolved
        if exam.status == ExamStatus.PENDING_REVIEW:
            exam.status = ExamStatus.RESOLVED
            exam.clash_reason = None # Clear the reason

    exam.save() # Saves the updated status and updated_at timestamp (FR-10)
    return clash_detected