require 'jekyll'

namespace :build do
  desc "Build the Jekyll site"
  task :site do
    puts "Building Jekyll site..."
    Jekyll::Commands::Build.process({})
    puts "Build complete!"
  end
end

desc "Start Jekyll development server"
task :serve do
  puts "Starting Jekyll development server..."
  Jekyll::Commands::Serve.process({})
end

task :default => 'build:site'

namespace :audit do
  desc "Scan Ruby gems for known vulnerabilities"
  task :ruby do
    puts "Scanning Ruby gems for vulnerabilities..."
    success = system("bundle-audit check --update")
    if success
      puts "No known vulnerabilities found in Ruby gems."
    else
      abort "Ruby gem vulnerabilities detected!"
    end
  end

  desc "Scan npm packages for known vulnerabilities"
  task :npm do
    puts "Scanning npm packages for vulnerabilities..."
    success = system("npm audit --audit-level=moderate")
    if success
      puts "No known vulnerabilities found in npm packages."
    else
      abort "npm package vulnerabilities detected!"
    end
  end

  desc "Scan all dependencies (Ruby + npm) for vulnerabilities"
  task :all => [:ruby, :npm]
end

desc "Scan Ruby gems for known vulnerabilities"
task :audit => 'audit:ruby'
