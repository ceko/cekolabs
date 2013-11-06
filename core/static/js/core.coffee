$ ->
	$('#top-bar .top-bar-links').menu(
		position:	
			my: 'left top',
			at: 'left+1 bottom-1'
		#focus: (evt, ui) ->
			#$(evt.currentTarget).addClass('ui-focus')
		#blur: (evt, ui) ->
			#$('#top-bar .ui-focus').each ->
			#	$(this).removeClass('ui-focus')
			#$('#top-bar .top-bar-links').menu( "collapseAll", null, true )
	)