from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from .models import Enrolment, Exam, ExamStatus, Room, Student, Unit
from .services import check_and_flag_exam_clashes
from datetime import date, time
import json

class ClashDetectionTests(TestCase):
    def setUp(self):
        self.student = Student.objects.create(admission_number="ST001", name="Test Student")
        self.maths = Unit.objects.create(unit_code="MAT101", unit_name="Mathematics")
        self.physics = Unit.objects.create(unit_code="PHY101", unit_name="Physics")
        
        Enrolment.objects.create(student=self.student, unit=self.maths)
        Enrolment.objects.create(student=self.student, unit=self.physics)

        self.room = Room.objects.create(room_name="Room A", capacity=100)

    def test_overlapping_shared_student_exams_flag_both_exams(self):
        first_exam = Exam.objects.create(unit=self.maths, room=self.room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))
        second_exam = Exam.objects.create(unit=self.physics, room=self.room, exam_date=date(2026, 12, 1), start_time=time(10, 0), end_time=time(12, 0))

        check_and_flag_exam_clashes(second_exam)

        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(first_exam.status, ExamStatus.PENDING_REVIEW)
        self.assertEqual(second_exam.status, ExamStatus.PENDING_REVIEW)

    def test_back_to_back_exams_do_not_clash(self):
        first_exam = Exam.objects.create(unit=self.maths, room=self.room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))
        second_exam = Exam.objects.create(unit=self.physics, room=self.room, exam_date=date(2026, 12, 1), start_time=time(11, 0), end_time=time(13, 0))

        check_and_flag_exam_clashes(second_exam)
        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(first_exam.status, ExamStatus.SCHEDULED)
        self.assertEqual(second_exam.status, ExamStatus.SCHEDULED)

    def test_capacity_overflow_flags_exam(self):
        zero_room = Room.objects.create(room_name="Zero Room", capacity=0)
        
        exam = Exam.objects.create(unit=self.maths, room=zero_room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))
        check_and_flag_exam_clashes(exam)
        exam.refresh_from_db()
        
        self.assertEqual(exam.status, ExamStatus.PENDING_REVIEW)

    def test_independent_cohorts_do_not_clash(self):
        s2 = Student.objects.create(admission_number="ST002", name="Other Student")
        Enrolment.objects.filter(student=self.student, unit=self.physics).delete()
        Enrolment.objects.create(student=s2, unit=self.physics)

        e1 = Exam.objects.create(unit=self.maths, room=self.room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))
        e2 = Exam.objects.create(unit=self.physics, room=self.room, exam_date=date(2026, 12, 1), start_time=time(10, 0), end_time=time(12, 0))

        check_and_flag_exam_clashes(e1)
        check_and_flag_exam_clashes(e2)
        e1.refresh_from_db()
        e2.refresh_from_db()

        self.assertEqual(e1.status, ExamStatus.SCHEDULED)
        self.assertEqual(e2.status, ExamStatus.SCHEDULED)


class ApiContractTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        self.regular_user = User.objects.create_user(username="user", password="pw", is_staff=False)
        
        self.student = Student.objects.create(admission_number="ST001", name="Test Student")
        self.unit = Unit.objects.create(unit_code="MAT101", unit_name="Maths")
        self.room = Room.objects.create(room_name="Room A", capacity=50)
        Enrolment.objects.create(student=self.student, unit=self.unit)
        
        self.exam = Exam.objects.create(unit=self.unit, room=self.room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))

    def test_student_timetable_returns_their_exams(self):
        response = self.client.get(reverse('student-timetable', args=['ST001']))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['admission_number'], 'ST001')
        self.assertEqual(len(data['exams']), 1)

    def test_unknown_student_returns_404(self):
        response = self.client.get(reverse('student-timetable', args=['UNKNOWN']))
        self.assertEqual(response.status_code, 404)

    def test_student_timetable_rejects_writes(self):
        url = reverse('student-timetable', args=['ST001'])
        self.assertEqual(self.client.post(url, {}).status_code, 405)
        self.assertEqual(self.client.put(url, {}).status_code, 405)
        self.assertEqual(self.client.patch(url, {}).status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)

    def test_non_staff_cannot_create_exam(self):
        self.client.login(username="user", password="pw")
        response = self.client.post(reverse('exam-list'), data=json.dumps({}), content_type="application/json")
        self.assertEqual(response.status_code, 403)

    def test_staff_can_create_exam(self):
        self.client.login(username="admin", password="pw")
        payload = {
            "unit_id": self.unit.id,
            "room_id": self.room.id,
            "exam_date": "2026-12-02",
            "start_time": "09:00:00",
            "end_time": "11:00:00"
        }
        response = self.client.post(reverse('exam-list'), data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201)