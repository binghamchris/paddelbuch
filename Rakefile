require 'jekyll'
require 'jekyll-contentful-data-import'

# Load .env file for the current JEKYLL_ENV
def load_env!
  jekyll_env = ENV['JEKYLL_ENV'] || 'development'
  ['.env', ".env.#{jekyll_env}"].each do |file|
    next unless File.exist?(file)
    File.readlines(file).each do |line|
      line = line.strip
      next if line.empty? || line.start_with?('#')
      if (match = line.match(/\A([A-Za-z_][A-Za-z0-9_]*)=(.*)\z/))
        key = match[1]
        value = match[2].strip
        value = value[1..-2] if (value.start_with?('"') && value.end_with?('"')) ||
                                (value.start_with?("'") && value.end_with?("'"))
        ENV[key] ||= value
      end
    end
  end
end

load_env!

namespace :contentful do
  desc "Import data from Contentful"
  task :import do
    space_id = ENV['CONTENTFUL_SPACE_ID']
    access_token = ENV['CONTENTFUL_ACCESS_TOKEN']
    environment = ENV['CONTENTFUL_ENVIRONMENT'] || 'master'

    unless space_id && access_token
      puts "Error: CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN must be set"
      puts "Set them in .env.development or as environment variables"
      exit 1
    end

    puts "Importing data from Contentful..."
    puts "Space ID: #{space_id}"
    puts "Environment: #{environment}"

    Jekyll::Commands::Contentful.process([], {})

    puts "Import complete!"
  end
end

namespace :build do
  desc "Build the Jekyll site"
  task :site do
    puts "Building Jekyll site..."
    Jekyll::Commands::Build.process({})
    puts "Build complete!"
  end

  desc "Import Contentful data and build site"
  task :all => ['contentful:import', 'build:site']
end

desc "Start Jekyll development server"
task :serve do
  puts "Starting Jekyll development server..."
  Jekyll::Commands::Serve.process({})
end

task :default => 'build:all'
