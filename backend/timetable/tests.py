from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from django.db import IntegrityError
from .models import Enrolment, Exam, ExamStatus, Room, Student, Unit
from .services import check_and_flag_exam_clashes
from datetime import date, time
import json
import time as time_module

class ClashDetectionTests(TestCase):
    def setUp(self):
        self.student = Student.objects.create(admission_number="ST001", name="Test Student")
        self.maths = Unit.objects.create(unit_code="MAT101", unit_name="Mathematics")
        self.physics = Unit.objects.create(unit_code="PHY101", unit_name="Physics")
        
        Enrolment.objects.create(student=self.student, unit=self.maths)
        Enrolment.objects.create(student=self.student, unit=self.physics)

        self.room = Room.objects.create(room_name="Room A", capacity=100)
        self.other_room = Room.objects.create(room_name="Room B", capacity=100)

    def test_overlapping_shared_student_exams_flag_both_exams(self):
        first_exam = Exam.objects.create(unit=self.maths, room=self.room, exam_date=date(2026, 12, 1), start_time=time(9, 0), end_time=time(11, 0))
        second_exam = Exam.objects.create(unit=self.physics, room=self.room, exam_date=date(2026, 12, 1), start_time=time(10, 0), end_time=time(12, 0))

        check_and_flag_exam_clashes(second_exam)

        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(first_exam.status, ExamStatus.PENDING_REVIEW)
        self.assertEqual(second_exam.status, ExamStatus.PENDING_REVIEW)
        self.assertIn("Student clash with PHY101", first_exam.clash_reason)
        self.assertIn("Student clash with MAT101", second_exam.clash_reason)

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
        e2 = Exam.objects.create(unit=self.physics, room=self.other_room, exam_date=date(2026, 12, 1), start_time=time(10, 0), end_time=time(12, 0))

        check_and_flag_exam_clashes(e1)
        check_and_flag_exam_clashes(e2)
        e1.refresh_from_db()
        e2.refresh_from_db()

        self.assertEqual(e1.status, ExamStatus.SCHEDULED)
        self.assertEqual(e2.status, ExamStatus.SCHEDULED)

    def test_room_overlap_flags_both_exams(self):
        first_exam = Exam.objects.create(
            unit=self.maths, room=self.room, exam_date=date(2026, 12, 1),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        second_exam = Exam.objects.create(
            unit=self.physics, room=self.room, exam_date=date(2026, 12, 1),
            start_time=time(10, 0), end_time=time(12, 0),
        )

        check_and_flag_exam_clashes(second_exam)
        first_exam.refresh_from_db()
        second_exam.refresh_from_db()

        self.assertEqual(first_exam.status, ExamStatus.PENDING_REVIEW)
        self.assertEqual(second_exam.status, ExamStatus.PENDING_REVIEW)
        self.assertIn("Room already booked by MAT101", second_exam.clash_reason)
        self.assertIn("Room already booked by PHY101", first_exam.clash_reason)

    def test_reassigning_exam_rechecks_partner_exam(self):
        first_exam = Exam.objects.create(
            unit=self.maths, room=self.other_room, exam_date=date(2026, 12, 1),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        second_exam = Exam.objects.create(
            unit=self.physics, room=self.other_room, exam_date=date(2026, 12, 1),
            start_time=time(10, 0), end_time=time(12, 0),
        )
        check_and_flag_exam_clashes(second_exam)

        second_exam.exam_date = date(2026, 12, 2)
        second_exam.start_time = time(10, 0)
        second_exam.end_time = time(12, 0)
        second_exam.save()
        from .services import recheck_exam_clashes
        recheck_exam_clashes(second_exam, date(2026, 12, 1))

        first_exam.refresh_from_db()
        self.assertEqual(first_exam.status, ExamStatus.RESOLVED)
        self.assertIsNone(first_exam.clash_reason)

    def test_capacity_boundary_is_allowed(self):
        boundary_room = Room.objects.create(room_name="Boundary", capacity=2)
        second_student = Student.objects.create(admission_number="ST002", name="Second Student")
        Enrolment.objects.create(student=second_student, unit=self.maths)
        exam = Exam.objects.create(
            unit=self.maths, room=boundary_room, exam_date=date(2026, 12, 2),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        check_and_flag_exam_clashes(exam)
        exam.refresh_from_db()
        self.assertEqual(exam.status, ExamStatus.SCHEDULED)

    def test_capacity_overflow_by_one_is_flagged(self):
        small_room = Room.objects.create(room_name="Small", capacity=0)
        exam = Exam.objects.create(
            unit=self.maths, room=small_room, exam_date=date(2026, 12, 2),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        check_and_flag_exam_clashes(exam)
        exam.refresh_from_db()
        self.assertEqual(exam.status, ExamStatus.PENDING_REVIEW)

    def test_same_time_on_different_dates_does_not_clash(self):
        first_exam = Exam.objects.create(
            unit=self.maths, room=self.room, exam_date=date(2026, 12, 1),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        second_exam = Exam.objects.create(
            unit=self.physics, room=self.room, exam_date=date(2026, 12, 2),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        check_and_flag_exam_clashes(first_exam)
        check_and_flag_exam_clashes(second_exam)
        first_exam.refresh_from_db()
        second_exam.refresh_from_db()
        self.assertEqual(first_exam.status, ExamStatus.SCHEDULED)
        self.assertEqual(second_exam.status, ExamStatus.SCHEDULED)

    def test_room_none_does_not_crash(self):
        exam = Exam.objects.create(
            unit=self.maths, room=None, exam_date=date(2026, 12, 3),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        self.assertFalse(check_and_flag_exam_clashes(exam))


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
        self.assertEqual(
            data['exams'][0],
            {
                'id': self.exam.id,
                'unit_code': 'MAT101',
                'unit_name': 'Maths',
                'room_name': 'Room A',
                'exam_date': '2026-12-01',
                'start_time': '09:00:00',
                'end_time': '11:00:00',
                'status': ExamStatus.SCHEDULED,
                'clash_reason': None,
            },
        )

    def test_student_timetable_returns_empty_schedule(self):
        Enrolment.objects.all().delete()

        response = self.client.get(reverse('student-timetable', args=['ST001']))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'admission_number': 'ST001', 'exams': []})

    def test_student_timetable_returns_status_and_clash_data(self):
        second_unit = Unit.objects.create(unit_code="PHY101", unit_name="Physics")
        Enrolment.objects.create(student=self.student, unit=second_unit)
        Exam.objects.create(
            unit=second_unit,
            exam_date=date(2026, 12, 2),
            start_time=time(9, 0),
            end_time=time(11, 0),
            status=ExamStatus.PENDING_REVIEW,
            clash_reason="Overlaps with another enrolled exam",
        )

        response = self.client.get(reverse('student-timetable', args=['ST001']))

        self.assertEqual(response.status_code, 200)
        clash_exam = response.json()['exams'][1]
        self.assertEqual(clash_exam['status'], ExamStatus.PENDING_REVIEW)
        self.assertEqual(clash_exam['clash_reason'], "Overlaps with another enrolled exam")

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

    def test_units_and_rooms_are_available(self):
        units = self.client.get(reverse('unit-list'))
        rooms = self.client.get(reverse('room-list'))

        self.assertEqual(units.status_code, 200)
        self.assertEqual(units.json()['units'], [{
            'id': self.unit.id,
            'unit_code': 'MAT101',
            'unit_name': 'Maths',
        }])
        self.assertEqual(rooms.status_code, 200)
        self.assertEqual(rooms.json()['rooms'], [{
            'id': self.room.id,
            'room_name': 'Room A',
            'capacity': 50,
        }])

    def test_exam_list_supports_status_filter(self):
        self.exam.status = ExamStatus.PENDING_REVIEW
        self.exam.save()

        response = self.client.get(reverse('exam-list') + '?status=pending_review')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['exams']), 1)
        self.assertEqual(response.json()['exams'][0]['status'], ExamStatus.PENDING_REVIEW)

    def test_staff_can_reassign_exam_and_resolve_it(self):
        new_room = Room.objects.create(room_name="Room B", capacity=100)
        self.client.login(username="admin", password="pw")

        response = self.client.patch(
            reverse('exam-reassign', args=[self.exam.id]),
            data=json.dumps({
                'room_id': new_room.id,
                'exam_date': '2026-12-03',
                'start_time': '12:00:00',
                'end_time': '14:00:00',
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], ExamStatus.RESOLVED)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.room_id, new_room.id)
        self.assertEqual(str(self.exam.exam_date), '2026-12-03')

    def test_staff_login_endpoint_authenticates_staff(self):
        response = self.client.post(
            reverse('admin-login'),
            data=json.dumps({'username': 'admin', 'password': 'pw'}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['message'])

    def test_anonymous_cannot_create_or_reassign_exam(self):
        create_response = self.client.post(
            reverse('exam-list'),
            data=json.dumps({}),
            content_type="application/json",
        )
        reassign_response = self.client.patch(
            reverse('exam-reassign', args=[self.exam.id]),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(reassign_response.status_code, 403)

    def test_non_staff_cannot_reassign_exam(self):
        self.client.login(username="user", password="pw")
        response = self.client.patch(
            reverse('exam-reassign', args=[self.exam.id]),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_schedule_returns_400(self):
        self.client.login(username="admin", password="pw")
        invalid_date = self.client.post(
            reverse('exam-list'),
            data=json.dumps({
                'unit_id': self.unit.id,
                'room_id': self.room.id,
                'exam_date': 'not-a-date',
                'start_time': '09:00',
                'end_time': '11:00',
            }),
            content_type="application/json",
        )
        invalid_time = self.client.post(
            reverse('exam-list'),
            data=json.dumps({
                'unit_id': self.unit.id,
                'room_id': self.room.id,
                'exam_date': '2026-12-03',
                'start_time': '11:00',
                'end_time': '09:00',
            }),
            content_type="application/json",
        )
        self.assertEqual(invalid_date.status_code, 400)
        self.assertEqual(invalid_time.status_code, 400)
        self.assertIn('after', invalid_time.json()['error'])

    def test_admin_login_rejects_wrong_password_and_non_staff(self):
        wrong_password = self.client.post(
            reverse('admin-login'),
            data=json.dumps({'username': 'admin', 'password': 'wrong'}),
            content_type="application/json",
        )
        non_staff = self.client.post(
            reverse('admin-login'),
            data=json.dumps({'username': 'user', 'password': 'pw'}),
            content_type="application/json",
        )
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(non_staff.status_code, 401)

    def test_malformed_json_returns_400(self):
        self.client.login(username="admin", password="pw")
        response = self.client.post(
            reverse('exam-list'),
            data="{",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_malformed_login_json_returns_400(self):
        response = self.client.post(
            reverse('admin-login'),
            data="{",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unknown_reassignment_returns_400(self):
        self.client.login(username="admin", password="pw")
        response = self.client.patch(
            reverse('exam-reassign', args=[9999]),
            data=json.dumps({
                'exam_date': '2026-12-03',
                'start_time': '09:00',
                'end_time': '11:00',
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_reassignment_that_still_clashes_remains_pending(self):
        second_unit = Unit.objects.create(unit_code="PHY101", unit_name="Physics")
        Enrolment.objects.create(student=self.student, unit=second_unit)
        Exam.objects.create(
            unit=second_unit, room=self.room, exam_date=date(2026, 12, 5),
            start_time=time(10, 0), end_time=time(12, 0),
        )
        self.client.login(username="admin", password="pw")
        response = self.client.patch(
            reverse('exam-reassign', args=[self.exam.id]),
            data=json.dumps({
                'exam_date': '2026-12-05',
                'start_time': '09:00',
                'end_time': '11:00',
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], ExamStatus.PENDING_REVIEW)

    def test_student_timetable_excludes_unenrolled_units(self):
        other_unit = Unit.objects.create(unit_code="PHY101", unit_name="Physics")
        Exam.objects.create(
            unit=other_unit, room=self.room, exam_date=date(2026, 12, 4),
            start_time=time(9, 0), end_time=time(11, 0),
        )
        response = self.client.get(reverse('student-timetable', args=['ST001']))
        self.assertEqual(len(response.json()['exams']), 1)

    def test_duplicate_enrolment_is_rejected(self):
        with self.assertRaises(IntegrityError):
            Enrolment.objects.create(student=self.student, unit=self.unit)

    def test_room_delete_sets_exam_room_to_none(self):
        self.room.delete()
        self.exam.refresh_from_db()
        self.assertIsNone(self.exam.room_id)

    def test_student_delete_cascades_enrolment(self):
        enrolment_id = Enrolment.objects.get(student=self.student).id
        self.student.delete()
        self.assertFalse(Enrolment.objects.filter(id=enrolment_id).exists())

    def test_updated_at_changes_when_exam_status_changes(self):
        previous = self.exam.updated_at
        time_module.sleep(0.001)
        self.exam.status = ExamStatus.PENDING_REVIEW
        self.exam.save()
        self.exam.refresh_from_db()
        self.assertNotEqual(self.exam.updated_at, previous)