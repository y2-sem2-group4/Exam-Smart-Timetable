from django.contrib import admin
from .models import Student, Unit, Room, Enrolment, Exam

admin.site.register(Student)
admin.site.register(Unit)
admin.site.register(Room)
admin.site.register(Enrolment)
admin.site.register(Exam)