from django.urls import path
from . import views

urlpatterns = [
    path('exams/', views.exam_list, name='exam-list'),
    path('exams/<int:pk>/reassign/', views.reassign_exam, name='exam-reassign'),
    path('units/', views.unit_list, name='unit-list'),
    path('rooms/', views.room_list, name='room-list'),
    path('admin/login/', views.admin_login, name='admin-login'),
    path('csrf/', views.csrf_token, name='csrf-token'),
    path('timetable/<str:admission_number>/', views.student_timetable, name='student-timetable'),
]