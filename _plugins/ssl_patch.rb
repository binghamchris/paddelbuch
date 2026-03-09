# _plugins/ssl_patch.rb
# Conditionally monkey-patch HTTP::Connection#start_tls for Ruby 3.4+ / OpenSSL 3.x
# to prevent "certificate verify failed (unable to get certificate CRL)" errors.
# Maintains VERIFY_PEER mode while disabling CRL checking.

if RUBY_VERSION >= '3.4' || (defined?(OpenSSL::OPENSSL_LIBRARY_VERSION) &&
   OpenSSL::OPENSSL_LIBRARY_VERSION.start_with?('OpenSSL 3'))
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
end
