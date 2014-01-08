from django.conf import settings
from django.utils.cache import patch_vary_headers
import time

class MultiHostMiddleware:

    def process_request(self, request):
        try:
            request.META["LoadingStart"] = time.time()
            host = request.META["HTTP_HOST"]

            if host[-3:] == ":80":
                host = host[:-3] # ignore default port number, if present
            if settings.HOST_MIDDLEWARE_URLCONF_MAP.has_key(host):
                request.urlconf = settings.HOST_MIDDLEWARE_URLCONF_MAP[host]
                request.META["MultiHost"] = str(request.urlconf)
            else:
                request.META["MultiHost"] = str(settings.ROOT_URLCONF)

        except KeyError:
            pass # use default urlconf (settings.ROOT_URLCONF)

    def process_response(self, request, response):
        if request.META.has_key('MultiHost'):
            response['MultiHost'] = request.META.get("MultiHost")

        if request.META.has_key('LoadingStart'):
            _loading_time = time.time() - int(request.META["LoadingStart"])
            response['LoadingTime'] = "%.2fs" % ( _loading_time, )

        if getattr(request, "urlconf", None):
            patch_vary_headers(response, ('Host',))
        return response