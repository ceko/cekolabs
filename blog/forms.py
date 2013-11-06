from django import forms
from cekolabs.blog import models
import cekolabs_django_widgets.widgets
import cekolabs_django_widgets.fields
    

class Post(forms.ModelForm):
    
    slug = forms.SlugField(max_length=50)
    title = forms.CharField(label = 'title', max_length=255)
    tags = cekolabs_django_widgets.fields.TagField()
    markdown = forms.CharField(label = "content", widget = cekolabs_django_widgets.widgets.MarkdownEditor, required=True)    
    published = forms.BooleanField(label = "published", required=False)
    featured = forms.BooleanField(label = "featured", required=False)
    teaser = forms.CharField(label = "teaser", widget = cekolabs_django_widgets.widgets.MarkdownEditor, required=True)
    teaser_image = forms.FileField(label = "teaser image", required=False)
    
    def save(self, *args, **kwargs):        
        tags = self.cleaned_data.get('tags', [])
        saved_tags = models.Tag.objects.filter(name__in=tags)
        for tag in tags:
            #add any new tags to the database.
            if not any(t for t in saved_tags if t.name == tag):
                new_tag = models.Tag()
                new_tag.name = tag
                new_tag.save()
                
        model = super(Post, self).save(*args, **kwargs)
        
        return model
    
    class Meta:
        model = models.Post

class BlogFile(forms.ModelForm):
    
    class Meta:
        exclude = ('byte_size', 'tags',)
        model = models.BlogFile