from django.conf.urls import patterns, url


urlpatterns = patterns('cekolabs.blog.views',
    url(r'^blog/new/$', 'posts.new', name='new'),
    url(r'^blog/(.+?)/(?P<id>\d+?)/edit/$', 'posts.edit', name='edit'),
    url(r'^blog/(.+?)/(?P<id>\d+?)/$', 'posts.view', name='view'),    
    url(r'^blog/list/$', 'posts.list', name='list'),
    url(r'^blog/tagsearch/(?P<tags>.*)/$', 'posts.tagsearch', name='tagsearch'),
    url(r'^blog/parse-markdown', 'posts.parse_markdown', name='parse_markdown'),
    url(r'^blog/files/manager/$', 'files.manager', name='file_manager'),
    url(r'^blog/files/manager/upload-ajax/$', 'files.upload_ajax', name='upload_ajax'),
    url(r'^blog/files/search/((?P<term>.*?)/)?$', 'files.search', name='search'),
)