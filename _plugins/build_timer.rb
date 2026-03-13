# Build Timer Plugin
#
# Instruments the Jekyll build to track where time is spent, with particular
# focus on translation loading (YAML.load_file for _i18n/*.yml) and the
# major generator/render phases.
#
# Output is written to $stdout so it appears inline with Jekyll's own messages.

module BuildTimer
  @phase_starts = {}

  class << self
    def now
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end

    def start(phase)
      @phase_starts[phase] = now
    end

    def finish(phase)
      started = @phase_starts.delete(phase)
      return unless started

      elapsed = now - started
      puts "[build-timer] #{phase} completed in #{format_duration(elapsed)}"
    end

    def log(message)
      puts "[build-timer] #{message}"
    end

    private

    def format_duration(seconds)
      if seconds >= 1.0
        format('%.2fs', seconds)
      else
        format('%.0fms', seconds * 1000)
      end
    end
  end
end

# ---------------------------------------------------------------------------
# :site, :after_init — record the very start of the build
# ---------------------------------------------------------------------------
Jekyll::Hooks.register :site, :after_init, priority: :high do |_site|
  BuildTimer.start('total_build')
  BuildTimer.log "Build started at #{Time.now.strftime('%H:%M:%S')}"
end

# ---------------------------------------------------------------------------
# :site, :pre_render — fires before each language pass renders.
# The i18n plugin loads translations in its own :pre_render hook (default
# priority). We register two hooks: one at :high priority (runs BEFORE the
# plugin) to start the timer, and one at :low priority (runs AFTER) to stop it.
# ---------------------------------------------------------------------------
Jekyll::Hooks.register :site, :pre_render, priority: :high do |site, _payload|
  lang = site.config['lang']
  BuildTimer.finish("read_and_generate:#{lang}")
  BuildTimer.start("translation_load:#{lang}")
  BuildTimer.log "--- Language pass: #{lang} (pre_render) ---"
end

Jekyll::Hooks.register :site, :pre_render, priority: :low do |site, _payload|
  lang = site.config['lang']
  BuildTimer.finish("translation_load:#{lang}")

  # Count pages + documents that will be rendered
  doc_count = site.documents.size + site.pages.size
  BuildTimer.log "Rendering #{doc_count} pages/documents for '#{lang}'"
  BuildTimer.start("render:#{lang}")
end

# ---------------------------------------------------------------------------
# :site, :post_render — fires after rendering, before writing files
# ---------------------------------------------------------------------------
Jekyll::Hooks.register :site, :post_render do |site, _payload|
  lang = site.config['lang']
  BuildTimer.finish("render:#{lang}")
  BuildTimer.start("write:#{lang}")
end

# ---------------------------------------------------------------------------
# :site, :post_write — fires after files are written to disk
# ---------------------------------------------------------------------------
Jekyll::Hooks.register :site, :post_write do |site|
  lang = site.config['lang']
  BuildTimer.finish("write:#{lang}")
end

# ---------------------------------------------------------------------------
# Monkey-patch Site#process to capture total build time and per-language
# generator timing. The original process method loops over languages and
# calls process_org for each one — we wrap process_org to time generators.
# ---------------------------------------------------------------------------

# Depends on jekyll-multiple-languages-plugin providing process_org on Jekyll::Site
module BuildTimerSiteExtension
  def process
    super
    BuildTimer.finish('total_build')
    BuildTimer.log "Build finished at #{Time.now.strftime('%H:%M:%S')}"
  end

  if Jekyll::Site.method_defined?(:process_org)
    def process_org
      lang = config['lang']
      BuildTimer.log "--- Language pass: #{lang} (read + generate) ---"
      BuildTimer.start("read_and_generate:#{lang}")
      super
    end
  else
    Jekyll.logger.warn 'BuildTimer:', 'Jekyll::Site#process_org not found (jekyll-multiple-languages-plugin missing?) — skipping per-language generator timing'
  end
end

Jekyll::Site.prepend(BuildTimerSiteExtension)
