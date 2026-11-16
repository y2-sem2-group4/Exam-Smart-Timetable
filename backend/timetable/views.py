from django.shortcuts import render
from django.http import JsonResponse
from .models import Exam, Enrolment, ExamStatus

# Create your views here.
def exam_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    else:
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