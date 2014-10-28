from pipeline.compressors import CompressorBase
import cssmin
from StringIO import StringIO
from django.core.serializers import json
import base64


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
        self.first = True
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
            self.first = False
        self.end_serialization()
        return self.getvalue()

LETTERS = 'ACBDEFHIKLMNOPT7JQRSU1VWXYZ4509G6328'

def vigenere(key, message, mode):
    translated = [] # stores the encrypted/decrypted message string
    
    keyIndex = 0
    key = key.upper()
    
    for symbol in message: # loop through each character in message
        if symbol.isdigit():
            num = LETTERS.find(symbol)
        else:
            num = LETTERS.find(symbol.upper())
        if num != -1: # -1 means symbol.upper() was not found in LETTERS
            if mode == 'encrypt':
                num += LETTERS.find(key[keyIndex]) # add if encrypting
            elif mode == 'decrypt':
                num -= LETTERS.find(key[keyIndex]) # subtract if decrypting
            
            num %= len(LETTERS) # handle the potential wrap-around
            
        # add the encrypted/decrypted symbol to the end of translated.
        if symbol.isupper():
            translated.append(LETTERS[num])
        elif symbol.islower():
            translated.append(LETTERS[num].lower())
        
            keyIndex += 1 # move to the next letter in the key
            if keyIndex == len(key):
                keyIndex = 0
        elif symbol.isdigit():
            translated.append(LETTERS[num])
        else:
            # The symbol was not in LETTERS, so add it to translated as is.
            translated.append(symbol)
    
    return ''.join(translated)

