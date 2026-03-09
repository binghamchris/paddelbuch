# Loads environment variables from .env files into Jekyll site config.
#
# Priority (highest to lowest):
#   1. System environment variables (already set in shell)
#   2. .env.{JEKYLL_ENV} file (e.g. .env.development, .env.production)
#   3. .env file (if it exists)
#
# Usage:
#   bundle exec jekyll build                          # loads .env.development (default)
#   JEKYLL_ENV=production bundle exec jekyll build     # loads .env.production
#
# Mapped config keys (available as site.* in templates):
#   CONTENTFUL_SPACE_ID       -> site.contentful.spaces[0].space
#   CONTENTFUL_ACCESS_TOKEN   -> site.contentful.spaces[0].access_token
#   CONTENTFUL_ENVIRONMENT    -> site.contentful.spaces[0].environment
#   MAPBOX_URL                -> site.mapbox_url
#   SITE_URL                  -> site.url

module Jekyll
  class EnvLoader
    ENV_VAR_PATTERN = /\A([A-Za-z_][A-Za-z0-9_]*)=(.*)\z/
    KNOWN_KEYS = %w[MAPBOX_URL CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT SITE_URL].freeze

    class << self
      def load_env_file(path)
        return {} unless File.exist?(path)

        vars = {}
        File.readlines(path).each do |line|
          line = line.strip
          next if line.empty? || line.start_with?('#')

          if (match = line.match(ENV_VAR_PATTERN))
            key = match[1]
            value = match[2].strip
            # Strip surrounding quotes
            value = value[1..-2] if (value.start_with?('"') && value.end_with?('"')) ||
                                    (value.start_with?("'") && value.end_with?("'"))
            vars[key] = value
          end
        end
        vars
      end
    end
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  jekyll_env = ENV['JEKYLL_ENV'] || 'development'
  source = site.source

  # Load env files (lower priority first, higher priority overwrites)
  env_vars = {}
  base_env = File.join(source, '.env')
  env_vars.merge!(Jekyll::EnvLoader.load_env_file(base_env))

  env_file = File.join(source, ".env.#{jekyll_env}")
  env_vars.merge!(Jekyll::EnvLoader.load_env_file(env_file))

  # System env vars take highest priority — check known keys directly
  # so they are picked up even when no .env file exists
  Jekyll::EnvLoader::KNOWN_KEYS.each do |key|
    env_vars[key] = ENV[key] if ENV[key]
  end

  # Also override any non-known file-loaded keys from system env
  env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] && !Jekyll::EnvLoader::KNOWN_KEYS.include?(k) }

  Jekyll.logger.info "Env Loader:", "Loaded .env.#{jekyll_env} (#{env_vars.keys.length} vars)"

  # Map env vars into site config
  if env_vars['CONTENTFUL_SPACE_ID'] || env_vars['CONTENTFUL_ACCESS_TOKEN']
    site.config['contentful'] ||= {}
    site.config['contentful']['spaces'] ||= [{}]
    space = site.config['contentful']['spaces'][0]
    space['space'] = env_vars['CONTENTFUL_SPACE_ID'] if env_vars['CONTENTFUL_SPACE_ID']
    space['access_token'] = env_vars['CONTENTFUL_ACCESS_TOKEN'] if env_vars['CONTENTFUL_ACCESS_TOKEN']
    space['environment'] = env_vars['CONTENTFUL_ENVIRONMENT'] if env_vars['CONTENTFUL_ENVIRONMENT']
  end

  # Map MAPBOX_URL to site.mapbox_url
  # Also handle the NEXT_PUBLIC_ prefixed version from legacy env files
  mapbox_url = env_vars['MAPBOX_URL'] || env_vars['NEXT_PUBLIC_MAPBOX_URL']
  site.config['mapbox_url'] = mapbox_url if mapbox_url

  # Map SITE_URL to site.url
  site_url = env_vars['SITE_URL'] || env_vars['NEXT_PUBLIC_SITE_URL']
  site.config['url'] = site_url if site_url

  # Also set them as actual ENV vars so Rake tasks and other plugins can use them
  env_vars.each { |k, v| ENV[k] ||= v }
end
