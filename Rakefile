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
