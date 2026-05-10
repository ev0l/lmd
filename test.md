# Markdown Test File
## Everything in the spec, in one place

---

## Headings

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

---

## Emphasis

Regular text with **bold**, *italic*, and ***bold italic***.

Also works with underscores: __bold__, _italic_, ___bold italic___.

~~Strikethrough text~~

---

## Blockquotes

> This is a simple blockquote.

> Blockquotes can span multiple lines.
> This is still the same blockquote.
> And so is this.

> Nested blockquotes work too.
>> This is nested one level.
>>> And a third level.

> Blockquotes can contain **bold**, *italic*, and `code`.

---

## Lists

### Unordered

- Item one
- Item two
  - Nested item
  - Another nested item
    - Deeply nested
- Item three

* Asterisk list item
* 
* Another asterisk item

### Ordered

1. First item
2. Second item
   1. Nested ordered
   2. Another nested
4. Third item

### Task List

- [x] Completed task
- [X] Incomplete task
- [x] Another done item
- [ ] Still to do

---

## Code

### Inline Code

Use `console.log()` to print. The `git status` command shows changes. Variables like `myVariable` are inline.

### Fenced Code Blocks

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`)
  return true
}

greet('world')
```

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))
```

```bash
#!/bin/bash
echo "Hello from bash"
ls -la | grep ".md"
```

```
Plain code block with no language specified.
Just preformatted text.
```

---

## Links

[Simple link](https://anthropic.com)

[Link with title](https://github.com "GitHub Homepage")

<https://autolink-example.com>

[Reference link][ref]

[ref]: https://example.com "Reference Example"

Bare URL: https://example.com (not always auto-linked)

---

## Images

![Placeholder image](https://placehold.co/600x200/png)

![Local image that may not exist](./screenshot.png)

---

## Tables

| Name  | Role     | Location  |                                                          |
| ----- | -------- | --------- | -------------------------------------------------------- |
| Alice | Engineer | Toronto   |                                                          |
| Bob   | Designer | Montreal  |                                                          |
| Carol | Product  | Vancouver | This is a test of some long text and to see what happens |



| Left align | Center align | Right align |
| ---------- | :----------: | ----------: |
| Left       |    Center    |       Right |
| Text       |     Text     |        Text |



---

## Horizontal Rules

Three dashes:

---

Three asterisks:

***

Three underscores:

___

---

## Mixed Inline Formatting

This sentence has **bold and *nested italic* inside bold** text.

Here is `inline code` alongside **bold** and _italic_ in one line.

A [**bold link**](https://example.com) and an *[italic link](https://example.com)*.

~~Strikethrough with **bold inside**~~

---

## Escaping

\*Not italic\* and \**not bold\**

\# Not a heading

\[Not a link\](https://example.com)

---

## Line Breaks

Two spaces at end of line for a hard break (may not be visible here)  
This is on a new line due to a hard break.

A blank line creates a new paragraph.

---

## HTML (if supported)

<strong>Raw HTML bold</strong>

<em>Raw HTML italic</em>

---

## Long Paragraph

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

---

*End of test file.*
