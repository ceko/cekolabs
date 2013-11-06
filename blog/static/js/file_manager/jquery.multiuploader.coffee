$ = jQuery

$.fn.extend	
	multiupload: (options) ->
		# Default settings
		settings =
			hover_class: 'hover'
			
		# Merge default settings with options.
		settings = $.extend settings, options
	
		@each (i, el) ->
			#The extension is called on the wrapper div.  We need to find the 
			#elements that TagInput is interested in now.
			$el = $(el)
			
	
			uploader = new MultiUploader($el)
	
		return @

	fileview: (options) ->
		$.fileview = 
			bind: FileView.bind
			
		# Default settings
		settings =
			default_presentation: 'table'
							
		# Merge default settings with options.
		settings = $.extend settings, options
	
		@each (i, el) ->
			#The extension is called on the wrapper div.  We need to find the 
			#elements that TagInput is interested in now.
			$el = $(el)			
	
			fileview = new FileView($el)
			el.fileview = fileview
		return @

class FileView

	@bind: (event, callback) =>
		$($('#file-list')[0].fileview).bind(event, callback)

	constructor: (@$wrap_el) ->
		@load_files()
		@_attach_behaviors()
	
	_attach_behaviors: ->
		@$wrap_el.find('#table-row-wrap').scroll (event) =>
			if event.target.offsetHeight + event.target.scrollTop >= event.target.scrollHeight
				@_autoload_more_rows()
		$('#expand-toggle').click (event) =>
			if $(event.target).hasClass('expanded')
				@$wrap_el.animate(
					width:'500px', =>
						$('#expand-toggle').removeClass('expanded')
				)
			else						
				@$wrap_el.animate(
					width:'750px', =>
						$('#expand-toggle').addClass('expanded')
				)
		$('#search').keyup (event) =>
			if event.keyCode == 13
				event.preventDefault()
				@$wrap_el.find('.table-rows').html('')
				@load_files('/blog/files/search/' + $('#search').val()) 
	
	_autoload_more_rows: ->
		if not @loading
			@loading = true
			@load_files('/blog/files/search/?start=' + @$wrap_el.find('.table-row').length)
						
	
	load_files: (url) ->
		 $.get(url or '/blog/files/search/')
			.success (data) =>
				@loading = false
				@_load_files_success.call(@, data)
			.error (data) =>
				@loading = false
				@_load_files_error.call(@, data)
	
	load_file: (record, append=true) ->
		$data_container = @$wrap_el.find('.table-rows');
		$row = $("<tr class='table-row'>
						<td class='checkbox'>
							<input type='checkbox' id='check_somethingorother' />
						</td>
						<td class='file-name'>
							<a href='#' class='file-name-link'>#{record.fields.file.replace('file_manager/', '')}</a>
						</td>
						<td class='upload-date'>
							#{record.fields.formatted_date}
						</td>												
						<td class='file-size'>
							#{record.fields.formatted_size}
						</td>
					 </tr>")
		$row[0].record = record
		$row.find('.file-name-link').click (event) =>
			$(@).trigger('record_choose', record)
		if append
			$data_container.append $row
		else
			$data_container.prepend $row
	
	_load_files_success: (data) ->		
		$data_container = @$wrap_el.find('.table-rows');		
		
		$(data).each (index, record) =>
			@load_file record

class MultiUploader

	constructor: (@$drop_target) ->
		@id_counter = 1
		@_attach_behaviors()
    
	_attach_behaviors: ->	
		@$drop_target.bind 'dragenter', (event) =>	@_dragenter event
		@$drop_target.bind 'dragover', (event) => @_dragenter event
		@$drop_target.bind 'drop', (event) => @_drop event
		@$drop_target.bind 'dragleave', (event) => @_dragleave event
	
	_dragenter: (event) ->
		event.stopPropagation()		
		event.preventDefault()
		@$drop_target.addClass 'hover'
	
	_dragleave: (event) ->
		event.stopPropagation()
		@$drop_target.removeClass 'hover'
	
	_drop: (event) ->
		event.stopPropagation()		
		event.preventDefault()
		for file in event.originalEvent.dataTransfer.files
			reader = new FileReader()
			reader.file = file
			reader.onload = (event) =>
				@_upload event.target.file, event.target.result
				
			reader.readAsDataURL(file)
			
		return false
		
	_upload: (file, data) ->
		
		$status_element = $ "<div id='#{@_incremental_id()}-upload' class='upload pending'>#{file.name}</div>"
		@$drop_target.append $status_element
		
		$.post('/blog/files/manager/upload-ajax/', {
				'name': file.name,
				'data': data.substring(data.indexOf(',') + 1),
			})
			.success (data) =>
				@_upload_success.call(@, data, $status_element)
			.error (data) =>
				@_upload_error.call(@, data, $status_element)		
	
	_incremental_id: ->
		return @id_counter++
	
	_upload_success: (data, $status_element) ->		
		if data.status == 'success'
			for file in data.files
				$('#file-list').get(0).fileview.load_file(file, false)
				
			$status_element.removeClass('pending').addClass('success') 
			callback = =>
				$status_element.fadeOut(2000)
			setTimeout callback, 5000
		else
			alert("error uploading #{data.file_name}") 
	
	_upload_error: (data, $status_element) ->
		$status_element.removeClass('pending').addClass('error') 		