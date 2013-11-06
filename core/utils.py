from pipeline.compressors import CompressorBase
import cssmin
from StringIO import StringIO
from django.core.serializers import json


class DefaultCompressor(CompressorBase):    
    
    def compress_js(self, js):
        raise Exception("Compressing javascript through the default compressor is not available.")
    
    def compress_css(self, css):        
        return cssmin.cssmin(css)
    
class SmartJSONSerializer(json.Serializer):
    
    def serialize_model(self, model, additional_properties, **options):
        """
        Serialize a queryset.
        """
        self.options = options

        self.stream = options.pop("stream", StringIO())
        self.selected_fields = options.pop("fields", None)
        self.use_natural_keys = options.pop("use_natural_keys", False)

        self.start_serialization()
        self.start_object(model)
        
        concrete_model = model._meta.concrete_model
        for field in concrete_model._meta.local_fields:
            if field.serialize:
                if field.rel is None:
                    if self.selected_fields is None or field.attname in self.selected_fields:
                        self.handle_field(model, field)
                else:
                    if self.selected_fields is None or field.attname[:-3] in self.selected_fields:
                        self.handle_fk_field(model, field)
        for field in concrete_model._meta.many_to_many:
            if field.serialize:
                if self.selected_fields is None or field.attname in self.selected_fields:
                    self.handle_m2m_field(model, field)
        
        for prop in additional_properties:
            self._current[prop] = getattr(model, prop)
            
        self.end_object(model)
        self.end_serialization()
        return self.getvalue()
        
    def serialize(self, queryset, additional_properties, **options):
        """
        Serialize a queryset.
        """
        self.options = options

        self.stream = options.pop("stream", StringIO())
        self.selected_fields = options.pop("fields", None)
        self.use_natural_keys = options.pop("use_natural_keys", False)

        self.start_serialization()
        for obj in queryset:
            self.start_object(obj)
            # Use the concrete parent class' _meta instead of the object's _meta
            # This is to avoid local_fields problems for proxy models. Refs #17717.
            concrete_model = obj._meta.concrete_model
            for field in concrete_model._meta.local_fields:
                if field.serialize:
                    if field.rel is None:
                        if self.selected_fields is None or field.attname in self.selected_fields:
                            self.handle_field(obj, field)
                    else:
                        if self.selected_fields is None or field.attname[:-3] in self.selected_fields:
                            self.handle_fk_field(obj, field)
            for field in concrete_model._meta.many_to_many:
                if field.serialize:
                    if self.selected_fields is None or field.attname in self.selected_fields:
                        self.handle_m2m_field(obj, field)
            
            for prop in additional_properties:
                self._current[prop] = getattr(obj, prop)
                
            self.end_object(obj)
        self.end_serialization()
        return self.getvalue()
        