from .models import Enrolment, Exam, ExamStatus


def _append_reason(reasons, reason):
    if reason not in reasons:
        reasons.append(reason)


def _mark_partner_exam(exam, reason):
    existing_reasons = [
        item for item in (exam.clash_reason or '').split(' | ') if item
    ]
    _append_reason(existing_reasons, reason)
    exam.status = ExamStatus.PENDING_REVIEW
    exam.clash_reason = ' | '.join(existing_reasons)
    exam.save(update_fields=['status', 'clash_reason', 'updated_at'])


def check_and_flag_exam_clashes(exam):
    """Evaluate capacity, room booking, and shared-student conflicts."""
    clash_detected = False
    reasons = []

    if exam.room:
        enrolled_count = Enrolment.objects.filter(unit=exam.unit).count()
        if enrolled_count > exam.room.capacity:
            clash_detected = True
            _append_reason(
                reasons,
                f"Room too small (Cap: {exam.room.capacity}, Enrolled: {enrolled_count})",
            )

    overlapping_exams = Exam.objects.filter(
        exam_date=exam.exam_date,
        start_time__lt=exam.end_time,
        end_time__gt=exam.start_time,
    ).exclude(id=exam.id).select_related('unit', 'room')
    students_in_this_unit = Enrolment.objects.filter(
        unit=exam.unit
    ).values_list('student_id', flat=True)

    for other_exam in overlapping_exams:
        if exam.room_id and exam.room_id == other_exam.room_id:
            clash_detected = True
            _append_reason(
                reasons,
                f"Room already booked by {other_exam.unit.unit_code}",
            )
            _mark_partner_exam(
                other_exam,
                f"Room already booked by {exam.unit.unit_code}",
            )

        shared_student_exists = Enrolment.objects.filter(
            unit=other_exam.unit,
            student_id__in=students_in_this_unit,
        ).exists()
        if shared_student_exists:
            clash_detected = True
            _append_reason(
                reasons,
                f"Student clash with {other_exam.unit.unit_code}",
            )
            _mark_partner_exam(
                other_exam,
                f"Student clash with {exam.unit.unit_code}",
            )

    if clash_detected:
        exam.status = ExamStatus.PENDING_REVIEW
        exam.clash_reason = ' | '.join(reasons)
    elif exam.status == ExamStatus.PENDING_REVIEW:
        exam.status = ExamStatus.RESOLVED
        exam.clash_reason = None

    exam.save()
    return clash_detected


def recheck_exam_clashes(exam, previous_date=None):
    """Re-evaluate pending exams on dates affected by a reassignment."""
    dates = {exam.exam_date}
    if previous_date:
        dates.add(previous_date)

    for related_exam in Exam.objects.filter(
        exam_date__in=dates
    ).exclude(id=exam.id).select_related('unit', 'room'):
        if related_exam.status == ExamStatus.PENDING_REVIEW:
            check_and_flag_exam_clashes(related_exam)
