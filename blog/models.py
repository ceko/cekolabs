from django.db import models
from django.template.defaultfilters import filesizeformat
from cekolabs.blog import markdown_extensions
import markdown

class Tag(models.Model):    
    name = models.CharField(max_length=50, primary_key=True)

class Post(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    slug = models.SlugField(default='');
    title = models.CharField(default='', max_length=255)
    tags = models.ManyToManyField(Tag)
    markdown = models.TextField(default='')
    published = models.BooleanField(default=False)
    featured = models.BooleanField(default=False)
    teaser = models.TextField(default='')
    teaser_image = models.FileField(upload_to='teasers/', null=True)

    def parsed_markdown(self):
        pretty_print_ext = markdown_extensions.PrettyPrintExtension()
        attribute_stack_ext = markdown_extensions.AttributeStackExtension()
        return markdown.markdown(self.markdown, extensions=['tables', pretty_print_ext, attribute_stack_ext])

    def parsed_teaser(self):
        pretty_print_ext = markdown_extensions.PrettyPrintExtension()
        attribute_stack_ext = markdown_extensions.AttributeStackExtension()
        return markdown.markdown(self.teaser, extensions=['tables', pretty_print_ext, attribute_stack_ext])

    def __unicode__(self):
        return "({0}) \"{1}\" @ /{2}".format(self.created, self.title, self.slug)

    class Meta:
        ordering = ['-created']

class BlogFile(models.Model):
    file = models.FileField(upload_to='file_manager/')    
    upload_date = models.DateTimeField(auto_now_add=True)
    byte_size = models.IntegerField()
    tags = models.ManyToManyField(Tag)
    
    @property
    def formatted_size(self):
        return filesizeformat(self.byte_size)

    @property
    def formatted_date(self):
        return self.upload_date.strftime('%Y/%m/%d %H:%M')

    @property
    def url(self):
        return self.file.url

    def save(self, *args, **kwargs):
        self.byte_size = self.file.size
        super(BlogFile, self).save(*args, **kwargs)