from django.db import models

# Table 1: Student
class Student(models.Model):
    admission_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.admission_number} - {self.name}"

# Table 2: Unit
class Unit(models.Model):
    unit_code = models.CharField(max_length=20, unique=True)
    unit_name = models.CharField(max_length=100)

    def __str__(self):
        return self.unit_code

# Table 3: Room
class Room(models.Model):
    room_name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()

    def __str__(self):
        return self.room_name

# Table 4: Enrolment (Links Students to Units)
class Enrolment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('student', 'unit') # Prevents duplicate enrollments

    def __str__(self):
        return f"{self.student.admission_number} in {self.unit.unit_code}"

# Exam Status Options
class ExamStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    PENDING_REVIEW = 'pending_review', 'Pending Review'
    RESOLVED = 'resolved', 'Resolved'

# Table 5: Exam
class Exam(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True)
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20, 
        choices=ExamStatus.choices, 
        default=ExamStatus.SCHEDULED
    )
    clash_reason = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.unit.unit_code} on {self.exam_date}"