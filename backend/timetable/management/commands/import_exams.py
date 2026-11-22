import csv
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from timetable.models import Exam, Unit, Room
from timetable.services import check_and_flag_exam_clashes
from django.db import transaction

class Command(BaseCommand):
    help = 'Import exams from a CSV file. Format: unit_code,room_name,exam_date,start_time,end_time'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='The path to the CSV file')

    @transaction.atomic
    def handle(self, *args, **options):
        file_path = options['csv_file']
        
        try:
            with open(file_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                
                # Verify headers
                expected_headers = {'unit_code', 'room_name', 'exam_date', 'start_time', 'end_time'}
                if not expected_headers.issubset(reader.fieldnames):
                    raise CommandError(f"CSV must contain headers: {', '.join(expected_headers)}")

                success_count = 0
                error_count = 0

                for row_num, row in enumerate(reader, start=2):
                    try:
                        unit = Unit.objects.get(unit_code=row['unit_code'])
                        room = Room.objects.get(room_name=row['room_name']) if row['room_name'] else None
                        
                        # Parse dates and times
                        exam_date = datetime.strptime(row['exam_date'], '%Y-%m-%d').date()
                        start_time = datetime.strptime(row['start_time'], '%H:%M').time()
                        end_time = datetime.strptime(row['end_time'], '%H:%M').time()

                        # Create the exam
                        exam = Exam.objects.create(
                            unit=unit,
                            room=room,
                            exam_date=exam_date,
                            start_time=start_time,
                            end_time=end_time
                        )
                        
                        # Run clash detection!
                        check_and_flag_exam_clashes(exam)
                        success_count += 1

                    except (Unit.DoesNotExist, Room.DoesNotExist, ValueError) as e:
                        self.stdout.write(self.style.ERROR(f"Row {row_num} failed: {str(e)}"))
                        error_count += 1

                self.stdout.write(self.style.SUCCESS(
                    f"Import complete. Success: {success_count}, Errors: {error_count}"
                ))

        except FileNotFoundError:
            raise CommandError(f"File '{file_path}' does not exist.")