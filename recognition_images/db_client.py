import os
import requests
from typing import List, Dict
from urllib.parse import quote
import logging

# Ваш существующий класс QF или его аналог
# Если у вас нет QF класса, можно использовать словарь

logger = logging.getLogger(__name__)

class DBClient:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("DB_API_URL", "http://213.172.24.109:8001")
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8'
        })
        
        # Настройка повторных попыток (можно добавить)
        from urllib3.util.retry import Retry
        from requests.adapters import HTTPAdapter
        
        retry = Retry(
            total=3,
            backoff_factor=0.1,
            status_forcelist=[500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    def search_breakers(self, qf_params: Dict) -> List[Dict]:
        """Поиск автоматических выключателей по параметрам"""
        try:
            # Поддерживаем как QF объект, так и словарь
            if hasattr(qf_params, 'ID_QF'):
                # Это QF объект
                params = {
                    "ID_QF": qf_params.ID_QF if qf_params.ID_QF else '',
                    "Current": qf_params.Current if qf_params.Current else '',
                    "Voltage": qf_params.Voltage if qf_params.Voltage else '',
                    "Current_Close": qf_params.Current_Close if qf_params.Current_Close else '',
                    "Mounting_Type": qf_params.Mounting_Type if qf_params.Mounting_Type else '',
                    "Name": qf_params.Name if qf_params.Name else '',
                    "Polus": qf_params.Polus if qf_params.Polus else ''
                }
            else:
                # Это словарь с параметрами
                params = {
                    "ID_QF": str(qf_params.get("id_qf", "")),
                    "Current": str(qf_params.get("current", "")),
                    "Voltage": str(qf_params.get("voltage", "")),
                    "Current_Close": str(qf_params.get("current_close", "")),
                    "Mounting_Type": str(qf_params.get("mounting_type", "")),
                    "Name": str(qf_params.get("name", "")),
                    "Polus": str(qf_params.get("polus", ""))
                }
            
            # Кодируем для URL
            encoded_params = {k: quote(str(v)) for k, v in params.items()}
            
            logger.debug(f"Поиск выключателей с параметрами: {params}")
            
            response = self.session.get(
                f"{self.base_url}/breakers",
                params=encoded_params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json().get("data", [])
            logger.debug(f"Найдено выключателей: {len(data)}")
            return data
            
        except Exception as e:
            logger.error(f"Ошибка поиска выключателей: {str(e)}")
            return []

    def search_transformators(self, params: Dict = None, limit: int = 10) -> List[Dict]:
        """Поиск трансформаторов"""
        try:
            query_params = {"limit": limit}
            
            # Если переданы дополнительные параметры
            if params:
                query_params.update(params)
            
            logger.debug(f"Поиск трансформаторов с параметрами: {query_params}")
            
            response = self.session.get(
                f"{self.base_url}/transformators",
                params=query_params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json().get("data", [])
            logger.debug(f"Найдено трансформаторов: {len(data)}")
            return data
            
        except Exception as e:
            logger.error(f"Ошибка поиска трансформаторов: {str(e)}")
            return []

    def search_counters(self, params: Dict = None, limit: int = 10) -> List[Dict]:
        """Поиск счетчиков"""
        try:
            query_params = {"limit": limit}
            
            # Если переданы дополнительные параметры
            if params:
                query_params.update(params)
            
            logger.debug(f"Поиск счетчиков с параметрами: {query_params}")
            
            response = self.session.get(
                f"{self.base_url}/counters",
                params=query_params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json().get("data", [])
            logger.debug(f"Найдено счетчиков: {len(data)}")
            return data
            
        except Exception as e:
            logger.error(f"Ошибка поиска счетчиков: {str(e)}")
            return []

    def search_by_type(self, element_type: str, params: Dict = None):
        """Универсальный метод поиска по типу элемента"""
        search_methods = {
            'QF': self.search_breakers,
            'transformer': self.search_transformators,
            'counter': self.search_counters
        }
        
        if element_type in search_methods:
            return search_methods[element_type](params or {})
        else:
            logger.warning(f"Неизвестный тип элемента: {element_type}")
            return []