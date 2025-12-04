require 'jekyll'
require 'jekyll-contentful-data-import'

namespace :contentful do
  desc "Import data from Contentful"
  task :import do
    # Load environment variables
    space_id = ENV['CONTENTFUL_SPACE_ID']
    access_token = ENV['CONTENTFUL_ACCESS_TOKEN']
    environment = ENV['CONTENTFUL_ENVIRONMENT'] || 'master'
    
    unless space_id && access_token
      puts "Error: CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN environment variables must be set"
      exit 1
    end
    
    puts "Importing data from Contentful..."
    puts "Space ID: #{space_id}"
    puts "Environment: #{environment}"
    
    # Run the Jekyll Contentful import
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
