from pipeline.compressors import CompressorBase
import cssmin


class DefaultCompressor(CompressorBase):    
    
    def compress_js(self, js):
        raise Exception("Compressing javascript through the default compressor is not available.")
    
    def compress_css(self, css):        
        return cssmin.cssmin(css)