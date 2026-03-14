---
inclusion: always
---

# Ruby Version Management

## Required Ruby Version

Always use Ruby 3.4.9 with chruby for this project.

## Command Pattern

```bash
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && <command>
```

## Examples

```bash
# Running Jekyll
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec jekyll serve

# Installing gems
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle install

# Running RSpec tests
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec
```

## Important

- Never run Ruby/Jekyll commands without first activating chruby with ruby-3.4.9
- Always use `bundle exec` for gem commands