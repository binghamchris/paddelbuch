# frozen_string_literal: true

# _plugins/ssl_patch.rb
#
# LOCAL DEVELOPMENT ONLY
#
# Addresses Ruby 3.4+ / OpenSSL 3.x CRL verification errors on macOS when the
# http gem (~> 5.x) makes outbound HTTPS requests during local Jekyll builds.
# The patch monkey-patches HTTP::Connection#start_tls to disable CRL checking
# while keeping VERIFY_PEER mode intact.
#
# This patch is NOT needed (and is skipped) in production/CI environments such
# as AWS Amplify, where the build container's certificate store does not trigger
# CRL verification failures.
#
# Activation conditions (ALL must be true):
#   1. JEKYLL_ENV is "development" (the default) — skipped for "production"
#   2. Ruby >= 3.4 OR OpenSSL 3.x is detected
#   3. HTTP::Connection#start_tls is defined (http gem loaded)

jekyll_env = ENV['JEKYLL_ENV'] || 'development'

unless jekyll_env == 'development'
  Jekyll.logger.debug 'SSLPatch:', "Skipped — not needed in #{jekyll_env} environment"
  return
end

if RUBY_VERSION >= '3.4' || (defined?(OpenSSL::OPENSSL_LIBRARY_VERSION) &&
   OpenSSL::OPENSSL_LIBRARY_VERSION.start_with?('OpenSSL 3'))

  if defined?(HTTP::Connection) && HTTP::Connection.method_defined?(:start_tls)
    http_gem_version = Gem.loaded_specs['http']&.version&.to_s
    if http_gem_version && !http_gem_version.start_with?('5.')
      Jekyll.logger.warn 'SSLPatch:', "http gem version #{http_gem_version} detected, patch targets 5.x — patch may not work correctly"
    end

    Jekyll.logger.info 'SSLPatch:', 'Applying local-dev CRL workaround for HTTP::Connection#start_tls'

    module HTTP
      class Connection
        alias_method :original_start_tls, :start_tls

        def start_tls(host, options)
          ssl_context = OpenSSL::SSL::SSLContext.new
          ssl_context.verify_mode = OpenSSL::SSL::VERIFY_PEER
          ssl_context.cert_store = OpenSSL::X509::Store.new
          ssl_context.cert_store.set_default_paths
          modified_options = options.dup
          modified_options = HTTP::Options.new(modified_options) unless modified_options.is_a?(HTTP::Options)
          original_start_tls(host, modified_options.with_ssl_context(ssl_context))
        end
      end
    end
  else
    Jekyll.logger.debug 'SSLPatch:', 'HTTP::Connection#start_tls not found — skipping'
  end
else
  Jekyll.logger.debug 'SSLPatch:', 'Ruby/OpenSSL version does not require CRL workaround — skipping'
end
