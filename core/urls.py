from __future__ import absolute_import, unicode_literals
from django.conf.urls import patterns, include, url
from django.contrib import admin
import cekolabs.blog.urls
from django.conf import settings
import ww_api.urls

admin.autodiscover()

urlpatterns = patterns('cekolabs.core.views',
    url(r'^$', 'home', name='home'),
    url(r'^django-form-architect$', 'django_form_architect', name='django_form_architect'),    
    url(r'^ksp-mods', 'ksp_mods', name='ksp_mods'),
    url(r'^card-game$', 'finch', name='finch'),
    url(r'^trainer$', 'magicka_trainer', name='magicka_trainer'),
    url(r'^trainer-save-history$', 'magicka_trainer_save_history', name='magicka_trainer_save_history'),
    url(r'^trainer-leaderboard/(?P<mode>.*)/(?P<timeframe>.*)/(?P<round_id>\d+?)$', 'magicka_trainer_leaderboard', name='magicka_trainer_leaderboard'),
    url(r'^trainer-token', 'get_encoded_server_time', name='magicka_trainer_token'),
    url(r'^empanada', 'empanada', name='empanada'),
    url(r'^webgl/particle-effect-builder$', 'particle_effect_builder', name='particle_effect_builder'),    
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    url(r'^admin/', include(admin.site.urls)),
)

urlpatterns += cekolabs.blog.urls.urlpatterns
urlpatterns += patterns('', url('^ww_api/', include(ww_api.urls.urlpatterns)))

handler500 = 'cekolabs.core.views.error_500'

if settings.DEBUG:
    urlpatterns += patterns('',
        url(r'^' + settings.MEDIA_URL.lstrip('/') + '(?P<path>.*)$', 'django.views.static.serve', {
            'document_root': settings.MEDIA_ROOT,
        }),
   )
