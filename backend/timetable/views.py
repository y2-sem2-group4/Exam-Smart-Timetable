from django.http import JsonResponse
from django.db import DatabaseError
from django.views.decorators.csrf import csrf_exempt
from .models import Exam, Enrolment, Student, Unit, Room
from .services import check_and_flag_exam_clashes
import json

@csrf_exempt
def exam_list(request):
    if request.method == 'GET':
        exams = Exam.objects.select_related('unit', 'room').all()
        exam_data = []

        for exam in exams:
            exam_data.append({
                'id': exam.id,
                'unit_code': exam.unit.unit_code,
                'unit_name': exam.unit.unit_name,
                'room_name': exam.room.room_name if exam.room else None,
                'exam_date': exam.exam_date.isoformat(),
                'start_time': exam.start_time.isoformat(),
                'end_time': exam.end_time.isoformat(),
                'status': exam.status,
                'clash_reason': exam.clash_reason,
            })

        return JsonResponse({'exams': exam_data}, status=200)

    elif request.method == 'POST':
        if not request.user.is_staff:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        
        try:
            data = json.loads(request.body)
            
            unit = Unit.objects.get(id=data['unit_id'])
            room = Room.objects.get(id=data['room_id']) if data.get('room_id') else None
            
            exam = Exam.objects.create(
                unit=unit,
                room=room,
                exam_date=data['exam_date'],
                start_time=data['start_time'],
                end_time=data['end_time']
            )
            
            check_and_flag_exam_clashes(exam)
            
            return JsonResponse({'message': 'Exam created', 'status': exam.status}, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


def student_timetable(request, admission_number):
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        student = Student.objects.get(admission_number=admission_number)
        enrolled_units = Enrolment.objects.filter(student=student).values_list('unit_id', flat=True)
        exams = Exam.objects.filter(unit_id__in=enrolled_units).select_related('unit', 'room')

        exam_data = []
        for exam in exams:
            exam_data.append({
                'unit_code': exam.unit.unit_code,
                'unit_name': exam.unit.unit_name,
                'room_name': exam.room.room_name if exam.room else None,
                'exam_date': exam.exam_date.isoformat(),
                'start_time': exam.start_time.isoformat(),
                'end_time': exam.end_time.isoformat(),
                'status': exam.status,
                'clash_reason': exam.clash_reason,
            })
    except Student.DoesNotExist:
        return JsonResponse({'error': 'Admission number not found'}, status=404)
    except DatabaseError:
        return JsonResponse({'error': 'Unable to load timetable'}, status=500)

    return JsonResponse({'admission_number': student.admission_number, 'exams': exam_data}, status=200)