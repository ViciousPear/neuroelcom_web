from django import forms

class UploadFileForm(forms.Form):
    file = forms.FileField(
        label='Выберите файл',
        widget=forms.FileInput(attrs={
            'accept': 'image/png, image/jpeg',
            'class': 'file-input'
        })
    )