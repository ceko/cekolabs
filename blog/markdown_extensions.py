from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor

class PrettyPrintTreeProcessor(Treeprocessor):

    def run(self, root):
        self.add_prettify_class(root)        

    def add_prettify_class(self, root):        
        for child in root:
            if child.tag == 'code':
                child.set('class', 'prettyprint linenums')
            self.add_prettify_class(child)

class PrettyPrintExtension(Extension):
    
    def extendMarkdown(self, md, md_globals):
        md.treeprocessors['google-prettify'] = PrettyPrintTreeProcessor()        
        
class AttributeStackTreeProcessor(Treeprocessor):
    
    def run(self, root):
        self.tag_stack_queue = []      
        self.finalized_tag_stacks = []  
        self.add_attributes(root)  
        
        for tag in self.finalized_tag_stacks:
            for child in tag['children']:
                tag['element'].append(child)    
                tag['parent'].remove(child)  
            tag['parent'].remove(tag['closer'])          

    def add_attributes(self, root):
        for child in root:
            if child.text and child.text.startswith('{{'):
                self.tag_stack_queue.append({'element': child, 'children' : [], 'parent' : root, 'closer' : None})
                child.tag = 'div'

                for attr in child.text[2:].split(','):
                    key, value = attr.strip().split(' ')                
                    child.set(key, value)
                    
                child.text = ''
            elif child.text and child.text.startswith('}}'):     
                self.tag_stack_queue[-1]['closer'] = child           
                self.finalized_tag_stacks.append(self.tag_stack_queue.pop())                
            else:
                if any(self.tag_stack_queue):
                    last_tag = self.tag_stack_queue[-1]
                    if last_tag['element'] in root:
                        last_tag['children'].append(child)
                                
            self.add_attributes(child)                
        
    
class AttributeStackExtension(Extension):
    
    def extendMarkdown(self, md, md_globals):        
        md.treeprocessors['attribute-stack'] = AttributeStackTreeProcessor()