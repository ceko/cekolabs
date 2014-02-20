from __future__ import absolute_import, unicode_literals
from django.conf.urls import patterns, include, url
from django.contrib import admin
from django.conf import settings


admin.autodiscover()

urlpatterns = patterns('cekolabs.core.views',
    url(r'^$', 'magicka_trainer_redirect', name='magicka_trainer_redirect'),
    url(r'^trainer$', 'magicka_trainer', name='magicka_trainer'),
    url(r'^trainer-save-history$', 'magicka_trainer_save_history', name='magicka_trainer_save_history'),
    url(r'^trainer-leaderboard/(?P<mode>.*)/(?P<round_id>\d+?)$', 'magicka_trainer_leaderboard', name='magicka_trainer_leaderboard'),
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    url(r'^admin/', include(admin.site.urls)),
)

handler500 = 'cekolabs.core.views.error_500'

if settings.DEBUG:
    urlpatterns += patterns('',
        url(r'^' + settings.MEDIA_URL.lstrip('/') + '(?P<path>.*)$', 'django.views.static.serve', {
            'document_root': settings.MEDIA_ROOT,
        }),
   )
