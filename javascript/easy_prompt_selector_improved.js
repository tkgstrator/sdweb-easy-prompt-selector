class EPSElementBuilder {
  // Templates
  static baseButton(text, { size = 'sm', color = 'primary' }) {
    const button = gradioApp().getElementById('txt2img_generate').cloneNode()
    button.id = ''
    button.classList.remove('gr-button-lg', 'gr-button-primary', 'lg', 'primary')
    button.classList.add(
      // gradio 3.16
      `gr-button-${size}`,
      `gr-button-${color}`,
      // gradio 3.22
      size,
      color,
      'prompt'
    )
    button.textContent = text

    return button
  }

  static category(depth, key) {
    const category = document.createElement('div')
    const title = document.createElement('div')
    title.textContent = key
    title.classList.add('title', `depth-${depth}`)
    category.classList.add('category', `depth-${depth}`)
    category.appendChild(title)
    return category
  }

  static tagList(depth) {
    const categoryList = document.createElement('div')
    categoryList.classList.add('tag-list', `depth-${depth}`)
    return categoryList
  }

  static tagFields() {
    const fields = document.createElement('div')
    return fields
  }

  // Elements
  static openButton({ onClick }) {
    const button = EPSElementBuilder.baseButton('Tags', { size: 'sm', color: 'secondary' })
    button.classList.add('easy_prompt_selector_improved_button')
    button.addEventListener('click', onClick)

    return button
  }

  static areaContainer(id = undefined) {
    const container = gradioApp().getElementById('txt2img_results').cloneNode()
    container.id = id
    container.style.gap = 0
    container.style.display = 'none'

    return container
  }

  static tagButton({ title, value, onClick, onRightClick, color = 'primary' }) {
    const button = EPSElementBuilder.baseButton(title, { color })
    button.style.height = '2rem'
    button.style.flexGrow = '0'
    button.style.margin = '4px'
    button.id = value

    button.addEventListener('click', onClick)
    button.addEventListener('contextmenu', onRightClick)

    return button
  }

  static dropDown(id, options, { onChange }) {
    const select = document.createElement('select')
    select.id = id

    // gradio 3.16
    select.classList.add('gr-box', 'gr-input')

    // gradio 3.22
    select.style.color = 'var(--body-text-color)'
    select.style.backgroundColor = 'var(--input-background-fill)'
    select.style.borderColor = 'var(--block-border-color)'
    select.style.borderRadius = 'var(--block-radius)'
    select.style.margin = '2px'
    select.addEventListener('change', (event) => { onChange(event.target.value) })

    const none = ['None']
    none.concat(options).forEach((key) => {
      const option = document.createElement('option')
      option.value = key
      option.textContent = key
      select.appendChild(option)
    })

    return select
  }
}

class EasyPromptSelector {
  PATH_FILE = 'tmp/easyPromptSelector.txt'
  AREA_ID = 'easy-prompt-selector'
  SELECT_ID = 'easy-prompt-selector-select'
  CONTENT_ID = 'easy-prompt-selector-content'
  TO_NEGATIVE_PROMPT_ID = 'easy-prompt-selector-to-negative-prompt'

  constructor(yaml, gradioApp) {
    this.yaml = yaml
    this.gradioApp = gradioApp
    this.visible = false
    this.toNegative = false
    this.tags = undefined
  }

  async init() {
    this.tags = await this.parseFiles()

    const tagArea = gradioApp().querySelector(`#${this.AREA_ID}`)
    if (tagArea != null) {
      this.visible = false
      this.changeVisibility(tagArea, this.visible)
      tagArea.remove()
    }

    gradioApp()
      .getElementById('txt2img_toprow')
      .after(this.render())
  }

  async readFile(filepath) {
    const response = await fetch(`file=${filepath}?${new Date().getTime()}`);

    return await response.text();
  }

  async parseFiles() {
    const text = await this.readFile(this.PATH_FILE);
    if (text === '') { return {} }

    const paths = text.split(/\r\n|\n/)

    const tags = {}
    for (const path of paths) {
      const filename = path.split('/').pop().split('.').shift()
      const data = await this.readFile(path)
      yaml.loadAll(data, function (doc) {
        tags[filename] = doc
      })
    }

    return tags
  }

  // Render
  render() {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '10px'

    const dropDown = this.renderDropdown()
    dropDown.style.flex = '1'
    dropDown.style.minWidth = '1'
    row.appendChild(dropDown)

    const settings = document.createElement('div')
    settings.style.flex = '1'

    row.appendChild(settings)

    const container = EPSElementBuilder.areaContainer(this.AREA_ID)

    container.appendChild(row)
    container.appendChild(this.renderContent())

    return container
  }

  renderDropdown() {
    const dropDown = EPSElementBuilder.dropDown(
      this.SELECT_ID,
      Object.keys(this.tags), {
        onChange: (selected) => {
          const content = gradioApp().getElementById(this.CONTENT_ID)
          Array.from(content.childNodes).forEach((node) => {
            const visible = node.id === `easy-prompt-selector-container-${selected}`
            this.changeVisibility(node, visible)
          })
        }
      }
    )

    return dropDown
  }

  renderContent() {
    const content = document.createElement('div')
    content.id = this.CONTENT_ID

    Object.keys(this.tags).forEach((key) => {
      const values = this.tags[key]

      const fields = EPSElementBuilder.tagFields()
      fields.id = `easy-prompt-selector-container-${key}`
      fields.style.display = 'none'
      fields.classList.add('easy-prompt-selector-container')

      this.renderTagButtons(values, key).forEach((group) => {
        fields.appendChild(group)
      })

      content.appendChild(fields)
    })

    return content
  }

  createField(key, depth) {
    const content = document.createElement('div')
    content.classList.add('fields', `depth-${depth}`)
    content.textContent = key
    content.style.flexDirection = 'column'
    return content
  }

  createDiv(className, depth) {
    const content = document.createElement('div')
    content.classList.add(className, `depth-${depth}`)
    return content
  }

  renderTagButtons(tags, prefix = '', depth = 0) {
    // Buttons has depth is exactly 1
    if (Array.isArray(tags)) {
      return tags.map((tag) => this.renderTagButton(tag, tag, 'secondary'))
    } else {
      return Object.keys(tags).map((key) => {
        const values = tags[key]
        const randomKey = `${prefix}:${key}`

        // Buttons has depth is exactly 1
        if (typeof values === 'string') {
          return this.renderTagButton(key, values, 'secondary')
        }

        const category = EPSElementBuilder.category(depth, key)
        const categoryList = EPSElementBuilder.tagList(depth)      
        category.appendChild(categoryList)
       
        this.renderTagButtons(values, randomKey, depth + 1).forEach((tagButton) => {
          categoryList.appendChild(tagButton)
        })

        return category
      })
    }
  }

  renderTagButton(title, value, color = 'primary') {
    return EPSElementBuilder.tagButton({
      title,
      value,
      onClick: (e) => {
        e.preventDefault();
        
        this.addTag(value, false || e.metaKey || e.ctrlKey)
      },
      onRightClick: (e) => {
        e.preventDefault();

        this.addTag(value, true || e.metaKey || e.ctrlKey)
      },
      color
    })
  }

  // Util
  changeVisibility(node, visible) {
    if (node !== null) {
      node.style.display = visible ? 'grid' : 'none';
    }
  }

  // Change Selected Class
  updateSelectedTags(node) {
    const app = gradioApp()
    const positive = new Set(app.getElementById('txt2img_prompt').querySelector('textarea').value.split(',').map((prompt) => prompt.trim()).filter((prompt) => prompt.length !== 0))
    const negative = new Set(app.getElementById('txt2img_neg_prompt').querySelector('textarea').value.split(',').map((prompt) => prompt.trim()).filter((prompt) => prompt.length !== 0))
    const buttons = node.querySelectorAll('button.prompt')
    
    buttons.forEach((button) => {
      const tags = Array.from(new Set(button.id.split(',').map((prompt) => prompt.trim()).filter((prompt) => prompt.length !== 0)))
      if (tags.every((tag) => positive.has(tag)) && tags.every((tag) => negative.has(tag))) {
        button.classList.add('selected', 'positive', 'negative')
        return
      }
      if (tags.every((tag) => positive.has(tag))) {
        button.classList.add('selected', 'positive')
        return
      }
      if (tags.every((tag) => negative.has(tag))) {
        button.classList.add('selected', 'negative')
        return
      }
    })
  }

  // Add Tag
  addTag(tag, toNegative = false) {
    const id = toNegative ? 'txt2img_neg_prompt' : 'txt2img_prompt'
    const textarea = gradioApp().getElementById(id).querySelector('textarea')
    const element = gradioApp().getElementById(tag)
    
    // Tags
    const tags = new Set(tag.split(',').map((tag) => tag.trim()).filter((tag) => tag.length !== 0))
    // Prompts
    const prompts = new Set(textarea.value.split(',').map((prompt) => prompt.trim()).filter((prompt) => prompt.length !== 0))

    if (Array.from(tags).every((tag) => prompts.has(tag))) {
      // Already selected negative and positive
      if (element.classList.contains('negative') && element.classList.contains('positive')) {
        element.classList.remove(toNegative ? 'negative' : 'positive')
      } else {
        element.classList.remove('selected', 'negative', 'positive')
      }
      textarea.value = Array.from(new Set([...prompts].filter((prompt) => !tags.has(prompt)))).join(', ') + ','
    } else {
      // Already selected
      if (!element.classList.contains('selected')) {
        element.classList.add('selected')
      }
      element.classList.add(toNegative ? 'negative' : 'positive')
      textarea.value = Array.from(new Set([...prompts, ...tags])).join(', ') + ','
    }
    
    updateInput(textarea)
  }
}

onUiLoaded(async () => {
  yaml = window.jsyaml
  const easyPromptSelector = new EasyPromptSelector(yaml, gradioApp())

  const button = EPSElementBuilder.openButton({
    onClick: () => {
      const tagArea = gradioApp().querySelector(`#${easyPromptSelector.AREA_ID}`)
      easyPromptSelector.changeVisibility(tagArea, easyPromptSelector.visible = !easyPromptSelector.visible)
    }
  })

  const reloadButton = gradioApp().getElementById('easy_prompt_selector_improved_reload_button')
  // Fix button width
  reloadButton.classList.add('lg', 'gradio-button', 'tool')
  reloadButton.classList.remove('sm')
  reloadButton.addEventListener('click', async () => {
    await easyPromptSelector.init()
  })

  const txt2imgActionColumn = gradioApp().getElementById('txt2img_actions_column')
  const container = document.createElement('div')
  container.classList.add('easy_prompt_selector_improved_container')
  container.appendChild(button)
  container.appendChild(reloadButton)

  txt2imgActionColumn.appendChild(container)

  await easyPromptSelector.init()
})
