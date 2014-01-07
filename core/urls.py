from __future__ import absolute_import, unicode_literals
from django.conf.urls import patterns, include, url
from django.contrib import admin
import cekolabs.blog.urls
from django.conf import settings


admin.autodiscover()

urlpatterns = patterns('cekolabs.core.views',
    url(r'^$', 'home', name='home'),
    url(r'^django-form-architect$', 'django_form_architect', name='django_form_architect'),
    url(r'^resume$', 'resume', name='resume'),
    url(r'^ksp-mods', 'ksp_mods', name='ksp_mods'),
    url(r'^trainer$', 'magicka_trainer', name='magicka_trainer'),
    url(r'^trainer-save-history$', 'magicka_trainer_save_history', name='magicka_trainer_save_history'),
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    url(r'^admin/', include(admin.site.urls)),
)

urlpatterns += cekolabs.blog.urls.urlpatterns
handler500 = 'cekolabs.core.views.error_500'

if settings.DEBUG:
    urlpatterns += patterns('',
        url(r'^' + settings.MEDIA_URL.lstrip('/') + '(?P<path>.*)$', 'django.views.static.serve', {
            'document_root': settings.MEDIA_ROOT,
        }),
   )
