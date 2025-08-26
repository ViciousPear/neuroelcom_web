import json

class CategoryManager:
    def __init__(self, category_name):
        self.category_name = category_name
        self.items = []  # Все элементы категории
    
    def add_item_group(self, item_group):
        """Добавляет группу элементов в категорию"""
        if not item_group or not isinstance(item_group, list):
            return
            
        for item in item_group:
            if not isinstance(item, dict):
                continue
                
            self.items.append({
                'id': item.get('id', ''),
                'name': item.get('name', ''),
                'price': item.get('price', '')
            })
    
    def prepare_for_template(self):
        """Подготавливает данные для шаблона в плоском формате"""
        if not self.items:
            return None
            
        article_options = []
        name_options = []
        price_options = []
        
        for item in self.items:
            item_data = {
                'id': item['id'],
                'name': item['name'],
                'price': item['price']
            }
            json_data = json.dumps(item_data, ensure_ascii=False)
            
            article_options.append({
                'value': json_data,
                'text': item['id']
            })
            name_options.append({
                'value': json_data,
                'text': item['name']
            })
            price_options.append({
                'value': json_data,
                'text': f"{item['price']} руб."
            })
        
        return {
            'name': self.category_name,
            'article_options': article_options,
            'name_options': name_options,
            'price_options': price_options
        }