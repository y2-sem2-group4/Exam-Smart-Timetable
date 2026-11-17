from datetime import date, time

from django.core.management.base import BaseCommand
from django.db import transaction

from timetable.models import Enrolment, Exam, Room, Student, Unit
from timetable.services import check_and_flag_exam_clashes


class Command(BaseCommand):
    help = 'Create or update safe, repeatable demo data without creating users.'

    @transaction.atomic
    def handle(self, *args, **options):
        students = {
            admission_number: Student.objects.update_or_create(
                admission_number=admission_number,
                defaults={'name': name},
            )[0]
            for admission_number, name in (
                ('ST001', 'Amina Otieno'),
                ('ST002', 'Brian Kamau'),
                ('ST003', 'Cynthia Wanjiku'),
            )
        }
        units = {
            code: Unit.objects.update_or_create(
                unit_code=code,
                defaults={'unit_name': name},
            )[0]
            for code, name in (
                ('MAT101', 'Mathematics'),
                ('PHY101', 'Physics'),
                ('CSC101', 'Computer Science'),
                ('ENG101', 'Academic Writing'),
            )
        }
        rooms = {
            name: Room.objects.update_or_create(
                room_name=name,
                defaults={'capacity': capacity},
            )[0]
            for name, capacity in (
                ('Demo Hall', 100),
                ('Demo Lab', 0),
                ('Demo Room', 50),
            )
        }

        enrolments = (
            ('ST001', 'MAT101'),
            ('ST001', 'PHY101'),
            ('ST002', 'CSC101'),
            ('ST003', 'ENG101'),
        )
        for admission_number, unit_code in enrolments:
            Enrolment.objects.get_or_create(
                student=students[admission_number],
                unit=units[unit_code],
            )

        exam_specs = (
            {
                'unit': units['MAT101'],
                'room': rooms['Demo Hall'],
                'exam_date': date(2026, 12, 1),
                'start_time': time(9, 0),
                'end_time': time(11, 0),
            },
            {
                'unit': units['PHY101'],
                'room': rooms['Demo Hall'],
                'exam_date': date(2026, 12, 1),
                'start_time': time(10, 0),
                'end_time': time(12, 0),
            },
            {
                'unit': units['CSC101'],
                'room': rooms['Demo Lab'],
                'exam_date': date(2026, 12, 2),
                'start_time': time(9, 0),
                'end_time': time(11, 0),
            },
            {
                'unit': units['ENG101'],
                'room': rooms['Demo Room'],
                'exam_date': date(2026, 12, 3),
                'start_time': time(9, 0),
                'end_time': time(11, 0),
            },
            {
                'unit': units['MAT101'],
                'room': rooms['Demo Room'],
                'exam_date': date(2026, 12, 3),
                'start_time': time(11, 0),
                'end_time': time(13, 0),
            },
        )
        for spec in exam_specs:
            exam, _ = Exam.objects.update_or_create(
                unit=spec['unit'],
                exam_date=spec['exam_date'],
                start_time=spec['start_time'],
                defaults={
                    'room': spec['room'],
                    'end_time': spec['end_time'],
                },
            )
            check_and_flag_exam_clashes(exam)

        self.stdout.write(self.style.SUCCESS(
            'Demo data seeded. No users or passwords were created.'
        ))
