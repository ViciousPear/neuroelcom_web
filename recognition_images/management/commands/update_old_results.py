# Создай файл recognition_images/management/commands/update_old_results.py

from django.core.management.base import BaseCommand
from recognition_images.models import DetectionResult

class Command(BaseCommand):
    help = 'Update old DetectionResult records with default status'

    def handle(self, *args, **options):
        # Для старых записей, у которых есть edited_data, считаем их завершенными
        updated = DetectionResult.objects.filter(
            results_viewed=False,
            is_edited=True
        ).update(
            status='finalized',
            results_viewed=True
        )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated} old records')
        )