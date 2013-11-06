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