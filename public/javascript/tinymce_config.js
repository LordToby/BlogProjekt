tinymce.init({
    allow_html_in_named_anchor: false,
    selector: 'textarea#my-expressjs-tinymce-app',
    language: 'da',
    height: 500,
    menubar: "insert",
    plugins: [
      'advlist autolink lists link image charmap print preview anchor',
      'searchreplace visualblocks code fullscreen',
      'insertdatetime media table paste code help wordcount',
      'images'
    ],
    toolbar: 'undo redo | formatselect | ' +
    'bold italic backcolor | alignleft aligncenter ' +
    'alignright alignjustify | bullist numlist outdent indent | ' +
    'removeformat | help | ' + 'images' ,
    content_langs: [
      { title: 'English', code: 'en' },
      { title: 'Spanish', code: 'es' },
      { title: 'French', code: 'fr' },
      { title: 'German', code: 'de' },
      { title: 'Portuguese', code: 'pt' },
      { title: 'Chinese', code: 'zh' },
      {title: 'Danish', code: 'dk'}
    ]

  });