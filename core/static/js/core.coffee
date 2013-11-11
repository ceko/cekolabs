$ ->
	$('#top-bar .top-bar-links').menu(
		position:	
			my: 'left top',
			at: 'left+1 bottom-1'		
	)
	$('#top-bar .projects').show()
	

packery_callback = ->
	$('#post-teasers').packery
		itemSelector: '.post-teaser-wrap'		  	
		  	
$(window).load ->
	$('#post-teasers').fadeIn()
	packery_callback()
	  
