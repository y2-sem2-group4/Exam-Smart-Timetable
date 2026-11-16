from django.test import TestCase
from django.urls import reverse
from .models import (
    Enrolment,
    Exam,
    ExamStatus,
    Room,
    Student,
    Unit,
)
from .services import check_and_flag_exam_clashes
from datetime import date, time


# Create your tests here.
class ClashDetectionTests(TestCase):
    def setUp(self):
        self.student = Student.objects.create(
            admission_number="ST001",
            name="Test Student",
        )

        self.maths = Unit.objects.create(
            unit_code="MAT101",
            unit_name="Mathematics",
        )

        self.physics = Unit.objects.create(
            unit_code="PHY101",
            unit_name="Physics",
        )

        Enrolment.objects.create(
            student=self.student,
            unit=self.maths,
        )

        Enrolment.objects.create(
            student=self.student,
            unit=self.physics,
        )

        self.room = Room.objects.create(
            room_name="Room A",
            capacity=100,
        )

    def test_overlapping_shared_student_exams_flag_both_exams(self):
        first_exam = Exam.objects.create(
            unit=self.maths,
            room=self.room,
            exam_date=date(2026, 12, 1),
            start_time=time(9, 0),
            end_time=time(11, 0),
        )

        second_exam = Exam.objects.create(
            unit=self.physics,
            room=self.room,
            exam_date=date(2026, 12, 1),
            start_time=time(10, 0),
            end_time=time(12, 0),
        )

        check_and_flag_exam_clashes(second_exam)

        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(
            first_exam.status,
            ExamStatus.PENDING_REVIEW,
        )
        self.assertEqual(
            second_exam.status,
            ExamStatus.PENDING_REVIEW,
        )

    def test_back_to_back_exams_do_not_clash(self):
        first_exam = Exam.objects.create(
            unit=self.maths,
            room=self.room,
            exam_date=date(2026, 12, 1),
            start_time=time(9, 0),
            end_time=time(11, 0),
        )

        second_exam = Exam.objects.create(
            unit=self.physics,
            room=self.room,
            exam_date=date(2026, 12, 1),
            start_time=time(11, 0),
            end_time=time(13, 0),
        )

        check_and_flag_exam_clashes(second_exam)

        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(first_exam.status, ExamStatus.SCHEDULED)
        self.assertEqual(second_exam.status, ExamStatus.SCHEDULED)


class ExamListApiTests(TestCase):
    def setUp(self):
        self.unit = Unit.objects.create(
            unit_code="API101",
            unit_name="API Testing",
        )
        self.room = Room.objects.create(
            room_name="API Room",
            capacity=50,
        )
        self.exam = Exam.objects.create(
            unit=self.unit,
            room=self.room,
            exam_date=date(2026, 12, 1),
            start_time=time(9, 0),
            end_time=time(11, 0),
        )
    def test_get_exams_returns_exam_data(self):
        response = self.client.get(reverse("exam-list"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["exams"]), 1)
        self.assertEqual(data["exams"][0]["id"], self.exam.id)
        self.assertEqual(data["exams"][0]["unit_code"], "API101")
        self.assertEqual(data["exams"][0]["status"], ExamStatus.SCHEDULED)