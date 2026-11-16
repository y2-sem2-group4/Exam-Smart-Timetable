from django.urls import path
from . import views

urlpatterns = [
    path('api/exams/', views.exam_list, name='exam-list'),
    path('api/timetable/<str:admission_number>/', views.student_timetable, name='student-timetable'),
]