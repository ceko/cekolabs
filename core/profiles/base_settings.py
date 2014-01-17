import os.path
import secret_settings
from django.conf.global_settings import TEMPLATE_CONTEXT_PROCESSORS as TCP


PROJECT_ROOT = "/".join(os.path.realpath(__file__).split('/')[:-3]) + "/"
DEBUG = False
TEMPLATE_DEBUG = DEBUG

HOST_MIDDLEWARE_URLCONF_MAP = {
    'apps.magickawizardwars.com': 'cekolabs.core.urls_magickawizardwars',
    'apps.magickawizardwars.com:8080': 'cekolabs.core.urls_magickawizardwars'
}

ADMINS = (
    ('Dave Lafferty', 'c.david.lafferty@gmail.com'),
)
MANAGERS = ADMINS

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# In a Windows environment this must be set to your system time zone.
TIME_ZONE = 'America/New_York'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale.
USE_L10N = True

# If you set this to False, Django will not use timezone-aware datetimes.
USE_TZ = True

# Absolute filesystem path to the directory that will hold user-uploaded files.
# Example: "/home/media/media.lawrence.com/media/"
MEDIA_ROOT = PROJECT_ROOT + 'uploads/'

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash.
# Examples: "http://media.lawrence.com/media/", "http://example.com/media/"
MEDIA_URL = '/uploads/'

# Absolute path to the directory static files should be collected to.
# Don't put anything in this directory yourself; store your static files
# in apps' "static/" subdirectories and in STATICFILES_DIRS.
# Example: "/home/media/media.lawrence.com/static/"
STATIC_ROOT = PROJECT_ROOT + 'static/'

# URL prefix for static files.
# Example: "http://media.lawrence.com/static/"
STATIC_URL = '/static/'

# List of finder classes that know how to find static files in
# various locations.
STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    #'django.contrib.staticfiles.finders.DefaultStorageFinder',
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = secret_settings.SECRET_KEY

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    ('django.template.loaders.cached.Loader', (
        'django.template.loaders.filesystem.Loader',
        'django.template.loaders.app_directories.Loader',
    )),
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'cekolabs.core.middleware.MultiHostMiddleware'
    #'pipeline.middleware.MinifyHTMLMiddleware',
    # Uncomment the next line for simple clickjacking protection:
    # 'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'cekolabs.core.urls'

# Python dotted path to the WSGI application used by Django's runserver.
WSGI_APPLICATION = 'cekolabs.core.wsgi.application'

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'south',    
    'django.contrib.admin',
    'pipeline',    
    'cekolabs.core',
    'cekolabs.blog',
    'cekolabs_django_widgets',
    # Uncomment the next line to enable admin documentation:
    # 'django.contrib.admindocs',
) 

TEMPLATE_CONTEXT_PROCESSORS = TCP + (
    'django.core.context_processors.request',
    'cekolabs.core.context_processors.features',
    'cekolabs.core.context_processors.projects',
)

PIPELINE = True
STATICFILES_STORAGE = 'pipeline.storage.PipelineCachedStorage'
PIPELINE_CSS_COMPRESSOR =  'cekolabs.core.utils.DefaultCompressor'
PIPELINE_JS_COMPRESSOR = 'pipeline.compressors.slimit.SlimItCompressor' 
PIPELINE_LESS_BINARY = '/usr/bin/lessc'
PIPELINE_COFFEE_BINARY = '/usr/bin/coffee'
PIPELINE_COMPILERS = (
  'pipeline.compilers.coffee.CoffeeScriptCompiler',
  'pipeline.compilers.less.LessCompiler',
)

PIPELINE_CSS = {
    'core': {
        'source_filenames': (
          'css/reset.css',
          'css/core.less', 
          'css/forms.less',
          'css/colorbox.css',
          'css/font-awesome.css'
        ),
        'output_filename': 'css/core.min.css',
    },
    'blog': {
        'source_filenames': (
            'css/blogview.less',
        ),
        'output_filename': 'css/blog.min.css',
    },    
    'file_manager': {
        'source_filenames': (
          'css/reset.css',
          'css/forms.less',          
          'css/file_manager/core.less',
        ),
        'output_filename': 'css/file_manager/core.filemanager.min.css',
    },
    'finch': {
        'source_filenames': (
            'css/finch/core.less',
        ),
        'output_filename': 'css/finch/core.css'
    },
    'finch-trainer': {
        'source_filenames': (
            'css/finch-trainer/core.less',
        ),
        'output_filename': 'css/finch-trainer/core.css'
    },
}

PIPELINE_JS = {
    'core': {
        'source_filenames': (          
          'js/core.coffee',  
          'js/promo.coffee',
          'js/jquery.colorbox.js',
          'js/packery.min.js'       
        ),
        'output_filename': 'js/core.min.js',
    },    
    'file_manager': {
        'source_filenames': (
          'js/file_manager/jquery.multiuploader.coffee',
        ),
        'output_filename': 'js/file_manager/core.filemanager.min.js',
    },
    'tags': {
        'source_filenames': (
            'js/blog/tags.coffee',
        ),
        'output_filename': 'js/tags.min.js',
    },
    'finch': {
        'source_filenames': (
            'js/jsrender.min.js',
            'js/finch/core.js',
        ),
        'output_filename': 'js/finch/core.min.js',
    },
    'finch-trainer': {
        'source_filenames': (
            'js/jsrender.min.js',
            'js/underscore.min.js',
            'js/backbone.min.js',
            'js/finch-trainer/core.js',
            'js/proton-1.0.0.min.js',
            'js/google-analytics.js'
        ),
        'output_filename': 'js/finch-trainer/core.min.js',
    }
}

# A sample logging configuration. The only tangible logging
# performed by this configuration is to send an email to
# the site admins on every HTTP 500 error when DEBUG=False.
# See http://docs.djangoproject.com/en/dev/topics/logging for
# more details on how to customize your logging configuration.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse'
        }
    },
    'handlers': {
        'mail_admins': {
            'level': 'ERROR',
            'filters': ['require_debug_false'],
            'class': 'django.utils.log.AdminEmailHandler'
        }
    },
    'loggers': {
        'django.request': {
            'handlers': ['mail_admins'],
            'level': 'ERROR',
            'propagate': True,
        },
    },
    'formatters': {
        'verbose': {
            'format' : "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s",
            'datefmt' : "%d/%b/%Y %H:%M:%S"
        },
    },
}
