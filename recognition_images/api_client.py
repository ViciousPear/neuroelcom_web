import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os


"""Класс для работы с API"""
class APIClient:
    def __init__(self, base_url=None):
        url = base_url or os.getenv("LOGIC_SERVICE_URL", "http://logic_service:8002")
        self.base_url = url.rstrip("/")
        self.session = requests.Session()
        self.timeout = 500
        self.session.trust_env = False

        retry = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)

    def post(self, endpoint, **kwargs):
        kwargs.setdefault("timeout", self.timeout)
        response = self.session.post(f"{self.base_url}/{endpoint.lstrip('/')}", **kwargs)
        response.raise_for_status()
        return response
    
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
        
    def detect_only(self, image_path):
        """Отправка изображения на удаленный сервер для обработки"""
        try:
            api_url = f"{self.base_url}/detect_only"
            
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
                'detection_results': data["detected_elements"]
            }
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ошибка соединения с сервером {self.base_url}: {str(e)}")
        except Exception as e:
            raise Exception(f"Ошибка обработки ответа сервера: {str(e)}")