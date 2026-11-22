import json

from datetime import date
from django.contrib.auth import authenticate, login
from django.db import DatabaseError
from django.utils.dateparse import parse_date, parse_time
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from .models import Enrolment, Exam, ExamStatus, Room, Student, Unit
from .services import check_and_flag_exam_clashes, recheck_exam_clashes


def _exam_data(exam):
    return {
        'id': exam.id,
        'unit_code': exam.unit.unit_code,
        'unit_name': exam.unit.unit_name,
        'room_name': exam.room.room_name if exam.room else None,
        'exam_date': exam.exam_date.isoformat(),
        'start_time': exam.start_time.isoformat(),
        'end_time': exam.end_time.isoformat(),
        'status': exam.status,
        'clash_reason': exam.clash_reason,
    }


def _json_body(request):
    try:
        data = json.loads(request.body)
    except (TypeError, ValueError):
        raise ValueError('Request body must contain valid JSON.')
    if not isinstance(data, dict):
        raise ValueError('Request body must contain a JSON object.')
    return data


def _require_staff(request):
    return request.user.is_authenticated and request.user.is_staff


def _validated_schedule(data, exam=None):
    exam_date = data.get('exam_date', exam.exam_date if exam else None)
    start_time = data.get('start_time', exam.start_time if exam else None)
    end_time = data.get('end_time', exam.end_time if exam else None)

    if isinstance(exam_date, str):
        exam_date = parse_date(exam_date)
    if isinstance(start_time, str):
        start_time = parse_time(start_time)
    if isinstance(end_time, str):
        end_time = parse_time(end_time)
    if exam_date is None:
        raise ValueError('exam_date must be a valid date in YYYY-MM-DD format.')
    if start_time is None or end_time is None:
        raise ValueError('start_time and end_time must be valid times.')
    if end_time <= start_time:
        raise ValueError('end_time must be after start_time.')
    # --- BE-11 ---
    from datetime import date
    if exam_date < date.today():
        raise ValueError('exam_date cannot be in the past.')

    return exam_date, start_time, end_time


@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@require_http_methods(['POST'])
def admin_login(request):
    try:
        data = _json_body(request)
    except ValueError as error:
        return JsonResponse({'error': str(error)}, status=400)
    user = authenticate(
        request,
        username=data.get('username', ''),
        password=data.get('password', ''),
    )
    if user is None or not user.is_staff:
        return JsonResponse({'error': 'Invalid username or password.'}, status=401)

    login(request, user)
    return JsonResponse({'message': 'Login successful'})


@require_http_methods(['GET', 'POST'])
def exam_list(request):
    if request.method == 'GET':
        exams = Exam.objects.select_related('unit', 'room').all()
        status = request.GET.get('status')
        if status:
            exams = exams.filter(status=status)
        return JsonResponse({'exams': [_exam_data(exam) for exam in exams]})

    if not _require_staff(request):
        return JsonResponse({'error': 'Forbidden'}, status=403)

    try:
        data = _json_body(request)
        unit = Unit.objects.get(id=data['unit_id'])
        room = Room.objects.get(id=data['room_id']) if data.get('room_id') else None
        exam_date, start_time, end_time = _validated_schedule(data)
        exam = Exam.objects.create(
            unit=unit,
            room=room,
            exam_date=exam_date,
            start_time=start_time,
            end_time=end_time,
        )
        clash = check_and_flag_exam_clashes(exam)
        return JsonResponse({
            'message': 'Exam created',
            'status': exam.status,
            'clash_reason': exam.clash_reason,
            'clash': clash,
        }, status=201)
    except (KeyError, TypeError, ValueError, Unit.DoesNotExist, Room.DoesNotExist) as error:
        return JsonResponse({'error': str(error)}, status=400)


@require_http_methods(['PATCH'])
def reassign_exam(request, pk):
    if not _require_staff(request):
        return JsonResponse({'error': 'Forbidden'}, status=403)

    try:
        data = _json_body(request)
        exam = Exam.objects.select_related('unit').get(pk=pk)
        previous_date = exam.exam_date
        if 'unit_id' in data:
            exam.unit = Unit.objects.get(id=data['unit_id'])
        if 'room_id' in data:
            exam.room = Room.objects.get(id=data['room_id']) if data['room_id'] else None
        exam.exam_date, exam.start_time, exam.end_time = _validated_schedule(data, exam)

        exam.status = ExamStatus.PENDING_REVIEW
        exam.save()
        clash = check_and_flag_exam_clashes(exam)
        recheck_exam_clashes(exam, previous_date)
        return JsonResponse({
            'message': 'Exam reassigned',
            'status': exam.status,
            'clash_reason': exam.clash_reason,
            'clash': clash,
        })
    except (
        KeyError,
        TypeError,
        ValueError,
        Exam.DoesNotExist,
        Room.DoesNotExist,
        Unit.DoesNotExist,
    ) as error:
        return JsonResponse({'error': str(error)}, status=400)


@require_GET
def unit_list(request):
    return JsonResponse({
        'units': list(Unit.objects.values('id', 'unit_code', 'unit_name')),
    })


@require_GET
def room_list(request):
    return JsonResponse({
        'rooms': list(Room.objects.values('id', 'room_name', 'capacity')),
    })


@require_GET
def student_timetable(request, admission_number):
    try:
        student = Student.objects.get(admission_number=admission_number)
        enrolled_units = Enrolment.objects.filter(student=student).values_list('unit_id', flat=True)
        exams = Exam.objects.filter(
            unit_id__in=enrolled_units
        ).select_related('unit', 'room')
    except Student.DoesNotExist:
        return JsonResponse({'error': 'Admission number not found'}, status=404)
    except DatabaseError:
        return JsonResponse({'error': 'Unable to load timetable'}, status=500)

    return JsonResponse({
        'admission_number': student.admission_number,
        'exams': [_exam_data(exam) for exam in exams],
    })
