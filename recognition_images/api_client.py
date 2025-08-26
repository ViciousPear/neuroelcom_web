import requests
import base64
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


"""Класс для работы с API"""
class APIClient:
    def __init__(self, base_url="http://82.202.129.245:8002"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.timeout = 500
        self.session.trust_env = False 
        self.session.mount('http://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1)))

        # Настройка повторных попыток и таймаутов
        retry = Retry(
            total=3,
            backoff_factor=0.1,
            status_forcelist=[500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
    
    def detect_image(self, image_path):
        """Отправка изображения на удаленный сервер для обработки"""
        try:
            api_url = f"{self.base_url}/detect_images"
            
            with open(image_path, 'rb') as f:
                response = self.session.post(
                    api_url,
                    files={'file': f},
                    timeout=(30, self.timeout)
                )
            
            response.raise_for_status()
            data = response.json()
            
            # Возвращаем полный ответ API как словарь
            return {
                'image_base64': data["image_base64"],
                'detection_results': data["detection_results"]
            }
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ошибка соединения с сервером {self.base_url}: {str(e)}")
        except Exception as e:
            raise Exception(f"Ошибка обработки ответа сервера: {str(e)}")