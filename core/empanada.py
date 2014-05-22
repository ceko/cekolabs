import cekolabs_empanada


class OutputFileTag(cekolabs_empanada.tags.SingleLineTag):    
    def render(self, context):
        ct = cekolabs_empanada.tokenizer.ExpressionTokenizer()
        parser = cekolabs_empanada.parsers.TopDownParser(ct.yield_tokens(' '.join(self.args)))
        file_path = parser.parse().eval(context)
        
        with open(file_path) as f:
            retval = f.read()
            
        return retval
    
cekolabs_empanada.tags.TagMap['outputfile'] = OutputFileTag

def capall(literal):
    return ' '.join([w.capitalize() for w in literal.split(' ')])
                                             
cekolabs_empanada.filters.FilterMap['capall'] = capall