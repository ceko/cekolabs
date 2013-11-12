$ ->
	$('#top-bar .top-bar-links').menu(
		position:	
			my: 'left top',
			at: 'left+1 bottom-1'		
	)
	$('#top-bar .projects').show()
	

packery_callback = ->
	$('div.post-teasers').packery
		itemSelector: '.post-teaser-wrap'		  	
		  	
$(window).load ->
	$('div.post-teasers').fadeIn()
	packery_callback()
	  
