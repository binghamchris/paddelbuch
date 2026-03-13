# _plugins/ssl_patch.rb
# Target: http gem ~> 5.x
# Addresses: Ruby 3.4+ / OpenSSL 3.x CRL verification errors
# Conditionally monkey-patch HTTP::Connection#start_tls to prevent
# "certificate verify failed (unable to get certificate CRL)" errors.
# Maintains VERIFY_PEER mode while disabling CRL checking.

if RUBY_VERSION >= '3.4' || (defined?(OpenSSL::OPENSSL_LIBRARY_VERSION) &&
   OpenSSL::OPENSSL_LIBRARY_VERSION.start_with?('OpenSSL 3'))

  if defined?(HTTP::Connection) && HTTP::Connection.method_defined?(:start_tls)
    http_gem_version = Gem.loaded_specs['http']&.version&.to_s
    if http_gem_version && !http_gem_version.start_with?('5.')
      Jekyll.logger.warn 'SSLPatch:', "http gem version #{http_gem_version} detected, patch targets 5.x — patch may not work correctly"
    end

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
    Jekyll.logger.warn 'SSLPatch:', 'HTTP::Connection#start_tls not found — skipping SSL patch'
  end
end
